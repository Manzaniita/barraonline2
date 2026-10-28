import { withAnonymousRlsContext, withTenantContext } from '@/db';
import { generateHighEntropyToken, sha256Hex } from '@/modules/security/crypto-vault';
import { computeBusinessDate } from '@/modules/tenancy/tenant-service';

export interface CheckoutCartItemInput {
  productId: string;
  quantity: number;
  // Si un cliente malicioso envía unitPriceCents en el payload, es ignorado por completo
  clientUntrustedPriceCents?: number;
}

export interface CreateCheckoutResult {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  totalCents: number;
  appliedCommissionBps: number;
  reservationId: string;
  reservationExpiresAt: string;
  orderAccessToken: string;
  isIdempotentReplay: boolean;
}

export async function createCheckoutAndReserveStock(params: {
  tenantId: string;
  idempotencyKey: string;
  items: CheckoutCartItemInput[];
  customerUserId?: string | null;
  customerDisplayName?: string | null;
  guestSessionToken?: string | null;
  guestRecoveryContact?: string | null;
  now?: Date;
}): Promise<CreateCheckoutResult> {
  const { tenantId, idempotencyKey, items, now = new Date() } = params;

  if (!idempotencyKey || idempotencyKey.trim().length < 6) {
    throw new Error('IDEMPOTENCY_KEY_REQUIRED: Se requiere una clave de idempotencia válida.');
  }

  if (!items || items.length === 0) {
    throw new Error('EMPTY_CART: El carrito no puede estar vacío.');
  }

  // Consolidamos ítems repetidos y ordenamos por productId ASC para evitar deadlocks en FOR UPDATE
  const consolidatedMap = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`INVALID_QUANTITY: Cantidad inválida para producto ${item.productId}`);
    }
    consolidatedMap.set(
      item.productId,
      (consolidatedMap.get(item.productId) ?? 0) + item.quantity
    );
  }
  const sortedProductIds = Array.from(consolidatedMap.keys()).sort();

  // 1. Verificamos estado del boliche y configuración de TTL / cutoff
  const tenantInfo = await withAnonymousRlsContext(async (tx) => {
    const res = await tx.query<{
      id: string;
      slug: string;
      status: string;
      business_day_cutoff_hour: number;
      reservation_ttl_seconds: number;
    }>(
      `SELECT id, slug, status, business_day_cutoff_hour, reservation_ttl_seconds
       FROM tenants
       WHERE id = $1`,
      [tenantId]
    );
    return res.rows[0] ?? null;
  });

  if (!tenantInfo) {
    throw new Error('TENANT_NOT_FOUND: El boliche solicitado no existe.');
  }
  if (tenantInfo.status !== 'ACTIVE') {
    throw new Error(
      `TENANT_UNAVAILABLE: El boliche no se encuentra habilitado para operar (${tenantInfo.status}).`
    );
  }

  return withTenantContext(tenantId, async (tx) => {
    // 2. Verificación de idempotencia: si ya existe una orden con esta idempotency_key en este tenant, devolvemos sin volver a reservar stock
    const existingOrderRes = await tx.query<{
      id: string;
      order_number: string;
      total_cents: string;
      applied_commission_bps: number;
      reservation_id: string;
      expires_at: string;
    }>(
      `SELECT o.id, o.order_number, o.total_cents, o.applied_commission_bps,
              sr.id AS reservation_id, sr.expires_at
       FROM orders o
       INNER JOIN stock_reservations sr ON sr.tenant_id = o.tenant_id AND sr.order_id = o.id
       WHERE o.idempotency_key = $1
       LIMIT 1`,
      [idempotencyKey]
    );

    if (existingOrderRes.rows[0]) {
      const existing = existingOrderRes.rows[0];
      return {
        orderId: existing.id,
        orderNumber: existing.order_number,
        tenantId,
        totalCents: Number(existing.total_cents),
        appliedCommissionBps: Number(existing.applied_commission_bps),
        reservationId: existing.reservation_id,
        reservationExpiresAt: existing.expires_at,
        orderAccessToken: 'IDEMPOTENT_REPLAY_TOKEN_ALREADY_ISSUED',
        isIdempotentReplay: true,
      };
    }

    // 3. Bloqueo pesimista (SELECT ... FOR UPDATE) en orden determinístico de productId ASC
    const lockedProducts: Array<{
      id: string;
      name: string;
      price_cents: number;
      promo_price_cents: number | null;
      stock_total: number;
      stock_reserved: number;
      stock_sold: number;
      max_per_order: number;
      is_active: boolean;
    }> = [];

    for (const productId of sortedProductIds) {
      const pRes = await tx.query<{
        id: string;
        name: string;
        price_cents: string;
        promo_price_cents: string | null;
        stock_total: number;
        stock_reserved: number;
        stock_sold: number;
        max_per_order: number;
        is_active: boolean;
      }>(
        `SELECT id, name, price_cents, promo_price_cents,
                stock_total, stock_reserved, stock_sold, max_per_order, is_active
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [productId]
      );

      const prod = pRes.rows[0];
      if (!prod || !prod.is_active) {
        throw new Error(
          `PRODUCT_NOT_AVAILABLE: La bebida seleccionada no existe o no está disponible en este boliche.`
        );
      }

      const requestedQty = consolidatedMap.get(productId)!;
      if (requestedQty > Number(prod.max_per_order)) {
        throw new Error(
          `MAX_PER_ORDER_EXCEEDED: Máximo ${prod.max_per_order} unidades por pedido para "${prod.name}".`
        );
      }

      const availableStock =
        Number(prod.stock_total) - Number(prod.stock_reserved) - Number(prod.stock_sold);
      if (availableStock < requestedQty) {
        throw new Error(
          `OUT_OF_STOCK: Stock insuficiente para "${prod.name}" (disponible: ${availableStock}, solicitado: ${requestedQty}).`
        );
      }

      lockedProducts.push({
        id: prod.id,
        name: prod.name,
        price_cents: Number(prod.price_cents),
        promo_price_cents:
          prod.promo_price_cents !== null ? Number(prod.promo_price_cents) : null,
        stock_total: Number(prod.stock_total),
        stock_reserved: Number(prod.stock_reserved),
        stock_sold: Number(prod.stock_sold),
        max_per_order: Number(prod.max_per_order),
        is_active: prod.is_active,
      });
    }

    // 4. Incrementamos stock_reserved en cada producto
    let subtotalCents = 0;
    const lineItemsToInsert: Array<{
      productId: string;
      nameSnapshot: string;
      unitPriceCents: number;
      quantity: number;
      lineTotalCents: number;
    }> = [];

    for (const prod of lockedProducts) {
      const qty = consolidatedMap.get(prod.id)!;
      const effectiveUnitPriceCents = prod.promo_price_cents ?? prod.price_cents;
      const lineTotalCents = effectiveUnitPriceCents * qty;
      subtotalCents += lineTotalCents;

      await tx.query(
        `UPDATE products
         SET stock_reserved = stock_reserved + $2,
             version = version + 1,
             updated_at = now()
         WHERE id = $1`,
        [prod.id, qty]
      );

      lineItemsToInsert.push({
        productId: prod.id,
        nameSnapshot: prod.name,
        unitPriceCents: effectiveUnitPriceCents,
        quantity: qty,
        lineTotalCents,
      });
    }

    // 5. Consultamos la regla contractual de comisión vigente para este boliche
    const commRuleRes = await tx.query<{
      id: string;
      commission_bps: number;
    }>(
      `SELECT id, commission_bps
       FROM tenant_commission_rules
       WHERE effective_from <= $1
         AND (effective_to IS NULL OR effective_to > $1)
       ORDER BY effective_from DESC
       LIMIT 1`,
      [now.toISOString()]
    );
    const activeRule = commRuleRes.rows[0];
    const appliedCommissionRuleId = activeRule?.id ?? null;
    const appliedCommissionBps = activeRule ? Number(activeRule.commission_bps) : 500; // Default 5.00% configurable

    // 6. Creamos el pedido y la reserva temporal de stock
    const businessDate = computeBusinessDate(now, tenantInfo.business_day_cutoff_hour);
    const { rawToken: orderAccessToken, tokenHash: orderAccessTokenHash, shortCode } =
      generateHighEntropyToken(24);
    const orderNumber = `${tenantInfo.slug.toUpperCase().slice(0, 6)}-${businessDate.replace(/-/g, '')}-${shortCode}`;
    const guestSessionHash = params.guestSessionToken
      ? sha256Hex(params.guestSessionToken)
      : null;

    const orderInsertRes = await tx.query<{ id: string }>(
      `INSERT INTO orders (
         tenant_id, order_number, customer_user_id, customer_display_name,
         guest_session_hash, guest_recovery_contact, order_access_token_hash,
         payment_status, fulfillment_status,
         subtotal_cents, discount_cents, total_cents,
         applied_commission_rule_id, applied_commission_bps,
         idempotency_key, business_date, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         'PENDING_CHECKOUT', 'AWAITING_PAYMENT',
         $8, 0, $8,
         $9, $10,
         $11, $12, $13, $13
       ) RETURNING id`,
      [
        tenantId,
        orderNumber,
        params.customerUserId ?? null,
        params.customerDisplayName ?? 'Invitado',
        guestSessionHash,
        params.guestRecoveryContact ?? null,
        orderAccessTokenHash,
        subtotalCents,
        appliedCommissionRuleId,
        appliedCommissionBps,
        idempotencyKey,
        businessDate,
        now.toISOString(),
      ]
    );
    const orderId = orderInsertRes.rows[0]!.id;

    for (const line of lineItemsToInsert) {
      await tx.query(
        `INSERT INTO order_items (
           tenant_id, order_id, product_id, product_name_snapshot,
           unit_price_cents, quantity, line_total_cents
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId,
          orderId,
          line.productId,
          line.nameSnapshot,
          line.unitPriceCents,
          line.quantity,
          line.lineTotalCents,
        ]
      );
    }

    const expiresAt = new Date(
      now.getTime() + tenantInfo.reservation_ttl_seconds * 1000
    ).toISOString();

    const reservationRes = await tx.query<{ id: string }>(
      `INSERT INTO stock_reservations (tenant_id, order_id, status, expires_at, created_at)
       VALUES ($1, $2, 'ACTIVE', $3, $4)
       RETURNING id`,
      [tenantId, orderId, expiresAt, now.toISOString()]
    );

    return {
      orderId,
      orderNumber,
      tenantId,
      totalCents: subtotalCents,
      appliedCommissionBps,
      reservationId: reservationRes.rows[0]!.id,
      reservationExpiresAt: expiresAt,
      orderAccessToken,
      isIdempotentReplay: false,
    };
  });
}

/**
 * Libera las reservas temporales vencidas para un boliche específico y devuelve el stock reservado.
 */
export async function releaseExpiredStockReservationsForTenant(
  tenantId: string,
  now: Date = new Date()
): Promise<{ releasedCount: number; releasedOrderIds: string[] }> {
  return withTenantContext(tenantId, async (tx) => {
    const expiredRes = await tx.query<{
      id: string;
      order_id: string;
    }>(
      `SELECT id, order_id
       FROM stock_reservations
       WHERE status = 'ACTIVE' AND expires_at <= $1
       FOR UPDATE`,
      [now.toISOString()]
    );

    const releasedOrderIds: string[] = [];

    for (const r of expiredRes.rows) {
      const itemsRes = await tx.query<{ product_id: string; quantity: number }>(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1
         ORDER BY product_id ASC`,
        [r.order_id]
      );

      for (const item of itemsRes.rows) {
        await tx.query(
          `UPDATE products
           SET stock_reserved = GREATEST(0, stock_reserved - $2),
               version = version + 1,
               updated_at = now()
           WHERE id = $1`,
          [item.product_id, Number(item.quantity)]
        );
      }

      await tx.query(
        `UPDATE stock_reservations
         SET status = 'RELEASED_EXPIRED',
             resolved_at = $2
         WHERE id = $1`,
        [r.id, now.toISOString()]
      );

      await tx.query(
        `UPDATE orders
         SET payment_status = CASE
               WHEN payment_status IN ('PENDING_CHECKOUT', 'AWAITING_WEBHOOK') THEN 'EXPIRED'::payment_status
               ELSE payment_status
             END,
             fulfillment_status = CASE
               WHEN fulfillment_status = 'AWAITING_PAYMENT' THEN 'CANCELLED_UNPAID'::fulfillment_status
               ELSE fulfillment_status
             END,
             updated_at = $2
         WHERE id = $1`,
        [r.order_id, now.toISOString()]
      );

      releasedOrderIds.push(r.order_id);
    }

    return {
      releasedCount: releasedOrderIds.length,
      releasedOrderIds,
    };
  });
}
