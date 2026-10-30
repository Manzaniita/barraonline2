import { withAnonymousRlsContext, withTenantContext } from '@/db';
import { formatArsFromCents } from '@/lib/format';
import { generateHighEntropyToken, sha256Hex } from '@/modules/security/crypto-vault';
import { computeBusinessDate } from '@/modules/tenancy/tenant-service';

export interface CheckoutCartItemInput {
  productId: string;
  quantity: number;
  // Si un cliente malicioso envía unitPriceCents en el payload, es ignorado por completo
  clientUntrustedPriceCents?: number;
  // Si el flujo Express envía el precio unitario vigente que vio el usuario, validamos si cambió antes de cobrar
  expectedUnitPriceCents?: number;
}

export interface CreateCheckoutResult {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  appliedCommissionBps: number;
  reservationId: string;
  reservationExpiresAt: string;
  orderAccessToken: string;
  isIdempotentReplay: boolean;
}

export interface DraftItemSnapshot {
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  savedUnitPriceCents: number;
}

export interface SaveOrderDraftResult {
  draftId: string;
  tenantId: string;
  savedStep: number;
  customerDisplayName: string | null;
  itemsSnapshot: DraftItemSnapshot[];
  subtotalSnapshotCents: number;
  draftAccessToken: string;
  canRecoverAcrossDevices: boolean;
  expiresAt: string;
}

export interface DraftValidationNotice {
  type: 'PRICE_CHANGED' | 'REMOVED_OUT_OF_STOCK' | 'QUANTITY_ADJUSTED';
  productId: string;
  productName: string;
  previousUnitPriceCents?: number;
  currentUnitPriceCents?: number;
  previousQuantity?: number;
  currentQuantity?: number;
  message: string;
}

export interface RecoverOrderDraftResult {
  draftId: string;
  tenantId: string;
  savedStep: number;
  customerDisplayName: string | null;
  validatedItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    regularPriceCents: number;
    availableStock: number;
    maxPerOrder: number;
    lineTotalCents: number;
  }>;
  previousSubtotalCents: number;
  currentSubtotalCents: number;
  currentDiscountCents: number;
  currentTotalCents: number;
  hasChanges: boolean;
  notices: DraftValidationNotice[];
  canRecoverAcrossDevices: boolean;
}

export interface AuthorizedCustomerOrderView {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  customerDisplayName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  reservationStatus: string | null;
  reservationExpiresAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    substitutedByProductName: string | null;
  }>;
  qr: {
    qrId: string;
    qrRawToken: string;
    qrShortCode: string;
    qrStatus: 'ACTIVE' | 'STOCK_CONFLICT' | 'REDEEMED' | 'REVOKED_REFUND' | 'EXPIRED';
    issuedAt: string;
    redeemedAt: string | null;
  } | null;
}

export async function createCheckoutAndReserveStock(params: {
  tenantId: string;
  idempotencyKey: string;
  items: CheckoutCartItemInput[];
  customerUserId?: string | null;
  customerDisplayName?: string | null;
  guestSessionToken?: string | null;
  guestRecoveryContact?: string | null;
  draftId?: string | null;
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
  const expectedPriceMap = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`INVALID_QUANTITY: Cantidad inválida para producto ${item.productId}`);
    }
    consolidatedMap.set(
      item.productId,
      (consolidatedMap.get(item.productId) ?? 0) + item.quantity
    );
    if (
      typeof item.expectedUnitPriceCents === 'number' &&
      Number.isFinite(item.expectedUnitPriceCents)
    ) {
      expectedPriceMap.set(item.productId, item.expectedUnitPriceCents);
    }
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
      subtotal_cents: string;
      discount_cents: string;
      total_cents: string;
      applied_commission_bps: number;
      reservation_id: string;
      expires_at: string;
    }>(
      `SELECT o.id, o.order_number, o.subtotal_cents, o.discount_cents, o.total_cents, o.applied_commission_bps,
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
        subtotalCents: Number(existing.subtotal_cents),
        discountCents: Number(existing.discount_cents),
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
          `PRODUCT_NOT_AVAILABLE: La bebida seleccionada no existe o dejó de estar disponible en este boliche.`
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

      const priceCents = Number(prod.price_cents);
      const promoPriceCents =
        prod.promo_price_cents !== null ? Number(prod.promo_price_cents) : null;
      const effectivePriceCents = promoPriceCents ?? priceCents;

      const expectedUnitPrice = expectedPriceMap.get(productId);
      if (
        expectedUnitPrice !== undefined &&
        expectedUnitPrice !== effectivePriceCents
      ) {
        throw new Error(
          `PRICE_CHANGED: El precio de "${prod.name}" se actualizó de ${formatArsFromCents(expectedUnitPrice)} a ${formatArsFromCents(effectivePriceCents)}. Revisá el nuevo importe antes de confirmar el pago.`
        );
      }

      lockedProducts.push({
        id: prod.id,
        name: prod.name,
        price_cents: priceCents,
        promo_price_cents: promoPriceCents,
        stock_total: Number(prod.stock_total),
        stock_reserved: Number(prod.stock_reserved),
        stock_sold: Number(prod.stock_sold),
        max_per_order: Number(prod.max_per_order),
        is_active: prod.is_active,
      });
    }

    // 4. Incrementamos stock_reserved en cada producto y calculamos subtotal, descuento promocional e importe final
    let regularSubtotalCents = 0;
    let discountCents = 0;
    let totalCents = 0;
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
      const lineRegularCents = prod.price_cents * qty;
      const lineTotalCents = effectiveUnitPriceCents * qty;
      const lineDiscountCents = Math.max(0, lineRegularCents - lineTotalCents);

      regularSubtotalCents += lineRegularCents;
      discountCents += lineDiscountCents;
      totalCents += lineTotalCents;

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
    const appliedCommissionBps = activeRule ? Number(activeRule.commission_bps) : 500;

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
         $8, $9, $10,
         $11, $12,
         $13, $14, $15, $15
       ) RETURNING id`,
      [
        tenantId,
        orderNumber,
        params.customerUserId ?? null,
        params.customerDisplayName ?? 'Invitado',
        guestSessionHash,
        params.guestRecoveryContact ?? null,
        orderAccessTokenHash,
        regularSubtotalCents,
        discountCents,
        totalCents,
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

    if (params.draftId) {
      await tx.query(
        `UPDATE order_drafts
         SET status = 'CONVERTED',
             converted_order_id = $2,
             updated_at = $3
         WHERE id = $1 AND status = 'SAVED'`,
        [params.draftId, orderId, now.toISOString()]
      );
    }

    return {
      orderId,
      orderNumber,
      tenantId,
      subtotalCents: regularSubtotalCents,
      discountCents,
      totalCents,
      appliedCommissionBps,
      reservationId: reservationRes.rows[0]!.id,
      reservationExpiresAt: expiresAt,
      orderAccessToken,
      isIdempotentReplay: false,
    };
  });
}

/**
 * Guarda un borrador del pedido sin generar cargos, sin emitir QR y sin reservar stock definitivo.
 * Vincula el borrador a la cuenta autenticada (`customerUserId`) y/o a la sesión actual (`guestSessionToken`).
 */
export async function saveOrderDraft(params: {
  tenantId: string;
  items: Array<{ productId: string; quantity: number }>;
  savedStep?: number;
  customerUserId?: string | null;
  customerDisplayName?: string | null;
  guestSessionToken?: string | null;
  now?: Date;
}): Promise<SaveOrderDraftResult> {
  const { tenantId, items, now = new Date() } = params;
  const savedStep = Math.min(3, Math.max(1, params.savedStep ?? 2));

  if (!items || items.length === 0) {
    throw new Error('EMPTY_DRAFT: Seleccioná al menos una bebida para guardar tu pedido.');
  }

  if (!params.customerUserId && !params.guestSessionToken) {
    throw new Error('SESSION_REQUIRED: Se requiere una sesión o cuenta activa para guardar el borrador.');
  }

  const consolidatedMap = new Map<string, number>();
  for (const item of items) {
    if (Number.isInteger(item.quantity) && item.quantity > 0) {
      consolidatedMap.set(
        item.productId,
        (consolidatedMap.get(item.productId) ?? 0) + item.quantity
      );
    }
  }
  const productIds = Array.from(consolidatedMap.keys());
  if (productIds.length === 0) {
    throw new Error('EMPTY_DRAFT: Seleccioná al menos una bebida válida.');
  }

  const guestSessionHash = params.guestSessionToken
    ? sha256Hex(params.guestSessionToken)
    : null;

  return withTenantContext(tenantId, async (tx) => {
    const itemsSnapshot: DraftItemSnapshot[] = [];
    let subtotalSnapshotCents = 0;

    for (const productId of productIds) {
      const pRes = await tx.query<{
        id: string;
        name: string;
        price_cents: string;
        promo_price_cents: string | null;
        is_active: boolean;
      }>(
        `SELECT id, name, price_cents, promo_price_cents, is_active
         FROM products
         WHERE id = $1`,
        [productId]
      );
      const prod = pRes.rows[0];
      if (!prod || !prod.is_active) {
        throw new Error(
          `PRODUCT_NOT_AVAILABLE: Uno de los productos seleccionados ya no se encuentra activo en la carta.`
        );
      }

      const qty = consolidatedMap.get(productId)!;
      const unitPriceCents =
        prod.promo_price_cents !== null
          ? Number(prod.promo_price_cents)
          : Number(prod.price_cents);

      itemsSnapshot.push({
        productId: prod.id,
        productNameSnapshot: prod.name,
        quantity: qty,
        savedUnitPriceCents: unitPriceCents,
      });
      subtotalSnapshotCents += unitPriceCents * qty;
    }

    const { rawToken: draftAccessToken, tokenHash: draftTokenHash } =
      generateHighEntropyToken(24);
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Descartamos borradores previos abiertos del mismo comprador/sesión en este boliche para mantener un único borrador activo limpio
    if (params.customerUserId) {
      await tx.query(
        `UPDATE order_drafts
         SET status = 'DISCARDED', updated_at = $2
         WHERE customer_user_id = $1 AND status = 'SAVED'`,
        [params.customerUserId, now.toISOString()]
      );
    } else if (guestSessionHash) {
      await tx.query(
        `UPDATE order_drafts
         SET status = 'DISCARDED', updated_at = $2
         WHERE guest_session_hash = $1 AND status = 'SAVED'`,
        [guestSessionHash, now.toISOString()]
      );
    }

    const insertRes = await tx.query<{ id: string }>(
      `INSERT INTO order_drafts (
         tenant_id, customer_user_id, guest_session_hash, draft_token_hash,
         status, saved_step, customer_display_name, items_snapshot,
         subtotal_snapshot_cents, expires_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'SAVED', $5, $6, $7::jsonb, $8, $9, $10, $10)
       RETURNING id`,
      [
        tenantId,
        params.customerUserId ?? null,
        guestSessionHash,
        draftTokenHash,
        savedStep,
        params.customerDisplayName ?? null,
        JSON.stringify(itemsSnapshot),
        subtotalSnapshotCents,
        expiresAt,
        now.toISOString(),
      ]
    );

    return {
      draftId: insertRes.rows[0]!.id,
      tenantId,
      savedStep,
      customerDisplayName: params.customerDisplayName ?? null,
      itemsSnapshot,
      subtotalSnapshotCents,
      draftAccessToken,
      canRecoverAcrossDevices: Boolean(params.customerUserId),
      expiresAt,
    };
  });
}

/**
 * Recupera un borrador de pedido verificando estrictamente la autorización del titular
 * y revalidando precios vigentes, promociones y stock disponible en tiempo real.
 */
export async function recoverAndValidateOrderDraft(params: {
  tenantId: string;
  draftId?: string | null;
  customerUserId?: string | null;
  guestSessionToken?: string | null;
  draftAccessToken?: string | null;
}): Promise<RecoverOrderDraftResult | null> {
  const guestSessionHash = params.guestSessionToken
    ? sha256Hex(params.guestSessionToken)
    : null;
  const draftTokenHash = params.draftAccessToken
    ? sha256Hex(params.draftAccessToken)
    : null;

  return withTenantContext(params.tenantId, async (tx) => {
    let draftRow:
      | {
          id: string;
          tenant_id: string;
          customer_user_id: string | null;
          guest_session_hash: string | null;
          draft_token_hash: string;
          status: string;
          saved_step: number;
          customer_display_name: string | null;
          items_snapshot: DraftItemSnapshot[];
          subtotal_snapshot_cents: string;
          expires_at: string;
        }
      | undefined;

    if (params.draftId) {
      const res = await tx.query<{
        id: string;
        tenant_id: string;
        customer_user_id: string | null;
        guest_session_hash: string | null;
        draft_token_hash: string;
        status: string;
        saved_step: number;
        customer_display_name: string | null;
        items_snapshot: DraftItemSnapshot[];
        subtotal_snapshot_cents: string;
        expires_at: string;
      }>(
        `SELECT id, tenant_id, customer_user_id, guest_session_hash, draft_token_hash,
                status, saved_step, customer_display_name, items_snapshot,
                subtotal_snapshot_cents, expires_at
         FROM order_drafts
         WHERE id = $1
         LIMIT 1`,
        [params.draftId]
      );
      draftRow = res.rows[0];
      if (!draftRow) {
        return null;
      }

      // Verificación estricta de autorización del titular del borrador
      const matchesUser =
        Boolean(params.customerUserId) &&
        draftRow.customer_user_id === params.customerUserId;
      const matchesGuestSession =
        Boolean(guestSessionHash) &&
        draftRow.guest_session_hash === guestSessionHash &&
        (!draftRow.customer_user_id ||
          draftRow.customer_user_id === params.customerUserId);
      const matchesToken =
        Boolean(draftTokenHash) && draftRow.draft_token_hash === draftTokenHash;

      if (!matchesUser && !matchesGuestSession && !matchesToken) {
        throw new Error(
          'FORBIDDEN_DRAFT_ACCESS: No tenés permiso para recuperar el borrador de otra persona.'
        );
      }
    } else {
      // Búsqueda automática del borrador activo del usuario o sesión actual
      if (params.customerUserId) {
        const res = await tx.query<{
          id: string;
          tenant_id: string;
          customer_user_id: string | null;
          guest_session_hash: string | null;
          draft_token_hash: string;
          status: string;
          saved_step: number;
          customer_display_name: string | null;
          items_snapshot: DraftItemSnapshot[];
          subtotal_snapshot_cents: string;
          expires_at: string;
        }>(
          `SELECT id, tenant_id, customer_user_id, guest_session_hash, draft_token_hash,
                  status, saved_step, customer_display_name, items_snapshot,
                  subtotal_snapshot_cents, expires_at
           FROM order_drafts
           WHERE customer_user_id = $1 AND status = 'SAVED' AND expires_at > now()
           ORDER BY updated_at DESC
           LIMIT 1`,
          [params.customerUserId]
        );
        draftRow = res.rows[0];
      }

      if (!draftRow && guestSessionHash) {
        const res = await tx.query<{
          id: string;
          tenant_id: string;
          customer_user_id: string | null;
          guest_session_hash: string | null;
          draft_token_hash: string;
          status: string;
          saved_step: number;
          customer_display_name: string | null;
          items_snapshot: DraftItemSnapshot[];
          subtotal_snapshot_cents: string;
          expires_at: string;
        }>(
          `SELECT id, tenant_id, customer_user_id, guest_session_hash, draft_token_hash,
                  status, saved_step, customer_display_name, items_snapshot,
                  subtotal_snapshot_cents, expires_at
           FROM order_drafts
           WHERE guest_session_hash = $1
             AND (customer_user_id IS NULL OR customer_user_id = $2)
             AND status = 'SAVED'
             AND expires_at > now()
           ORDER BY updated_at DESC
           LIMIT 1`,
          [guestSessionHash, params.customerUserId ?? null]
        );
        draftRow = res.rows[0];
      }
    }

    if (!draftRow || draftRow.status !== 'SAVED') {
      return null;
    }

    if (new Date(draftRow.expires_at).getTime() <= Date.now()) {
      await tx.query(
        `UPDATE order_drafts SET status = 'EXPIRED', updated_at = now() WHERE id = $1`,
        [draftRow.id]
      );
      return null;
    }

    const savedItems: DraftItemSnapshot[] = Array.isArray(draftRow.items_snapshot)
      ? draftRow.items_snapshot
      : [];

    const validatedItems: RecoverOrderDraftResult['validatedItems'] = [];
    const notices: DraftValidationNotice[] = [];
    let currentRegularSubtotalCents = 0;
    let currentTotalCents = 0;

    for (const saved of savedItems) {
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
         WHERE id = $1`,
        [saved.productId]
      );

      const prod = pRes.rows[0];
      const availableStock = prod
        ? Math.max(
            0,
            Number(prod.stock_total) -
              Number(prod.stock_reserved) -
              Number(prod.stock_sold)
          )
        : 0;

      if (!prod || !prod.is_active || availableStock <= 0) {
        notices.push({
          type: 'REMOVED_OUT_OF_STOCK',
          productId: saved.productId,
          productName: prod?.name ?? saved.productNameSnapshot,
          previousQuantity: saved.quantity,
          currentQuantity: 0,
          message: `"${prod?.name ?? saved.productNameSnapshot}" se agotó y fue quitado de tu selección.`,
        });
        continue;
      }

      const regularPriceCents = Number(prod.price_cents);
      const promoPriceCents =
        prod.promo_price_cents !== null ? Number(prod.promo_price_cents) : null;
      const currentUnitPriceCents = promoPriceCents ?? regularPriceCents;
      const maxPerOrder = Number(prod.max_per_order);

      let finalQty = Math.min(saved.quantity, availableStock, maxPerOrder);
      if (finalQty < saved.quantity) {
        notices.push({
          type: 'QUANTITY_ADJUSTED',
          productId: prod.id,
          productName: prod.name,
          previousQuantity: saved.quantity,
          currentQuantity: finalQty,
          message: `Ajustamos la cantidad de "${prod.name}" a ${finalQty} por disponibilidad actual en barra.`,
        });
      }

      if (currentUnitPriceCents !== saved.savedUnitPriceCents) {
        notices.push({
          type: 'PRICE_CHANGED',
          productId: prod.id,
          productName: prod.name,
          previousUnitPriceCents: saved.savedUnitPriceCents,
          currentUnitPriceCents,
          message: `El precio de "${prod.name}" se actualizó de ${formatArsFromCents(saved.savedUnitPriceCents)} a ${formatArsFromCents(currentUnitPriceCents)}.`,
        });
      }

      const lineTotalCents = currentUnitPriceCents * finalQty;
      currentRegularSubtotalCents += regularPriceCents * finalQty;
      currentTotalCents += lineTotalCents;

      validatedItems.push({
        productId: prod.id,
        productName: prod.name,
        quantity: finalQty,
        unitPriceCents: currentUnitPriceCents,
        regularPriceCents,
        availableStock,
        maxPerOrder,
        lineTotalCents,
      });
    }

    return {
      draftId: draftRow.id,
      tenantId: draftRow.tenant_id,
      savedStep: Number(draftRow.saved_step),
      customerDisplayName: draftRow.customer_display_name,
      validatedItems,
      previousSubtotalCents: Number(draftRow.subtotal_snapshot_cents),
      currentSubtotalCents: currentRegularSubtotalCents,
      currentDiscountCents: Math.max(0, currentRegularSubtotalCents - currentTotalCents),
      currentTotalCents,
      hasChanges: notices.length > 0,
      notices,
      canRecoverAcrossDevices: Boolean(draftRow.customer_user_id),
    };
  });
}

export async function discardOrderDraft(params: {
  tenantId: string;
  draftId: string;
  customerUserId?: string | null;
  guestSessionToken?: string | null;
}): Promise<void> {
  const guestSessionHash = params.guestSessionToken
    ? sha256Hex(params.guestSessionToken)
    : null;

  await withTenantContext(params.tenantId, async (tx) => {
    await tx.query(
      `UPDATE order_drafts
       SET status = 'DISCARDED', updated_at = now()
       WHERE id = $1
         AND (
           ($2::uuid IS NOT NULL AND customer_user_id = $2::uuid)
           OR ($3::varchar IS NOT NULL AND guest_session_hash = $3::varchar)
         )`,
      [params.draftId, params.customerUserId ?? null, guestSessionHash]
    );
  });
}

/**
 * Consulta el estado real de un pedido y su QR verificando estrictamente que quien consulta
 * sea el comprador titular (mediante `customerUserId`, `guestSessionToken` o `orderAccessToken`).
 * Si otra persona intenta consultar el pedido por UUID -> lanza `FORBIDDEN_ORDER_ACCESS`.
 * Además, el QR solo se expone cuando `payment_status === 'APPROVED'`.
 */
export async function getAuthorizedCustomerOrder(params: {
  tenantId: string;
  orderId: string;
  customerUserId?: string | null;
  guestSessionToken?: string | null;
  orderAccessToken?: string | null;
}): Promise<AuthorizedCustomerOrderView> {
  const guestSessionHash = params.guestSessionToken
    ? sha256Hex(params.guestSessionToken)
    : null;
  const accessTokenHash = params.orderAccessToken
    ? sha256Hex(params.orderAccessToken)
    : null;

  return withTenantContext(params.tenantId, async (tx) => {
    const orderRes = await tx.query<{
      id: string;
      tenant_id: string;
      order_number: string;
      customer_user_id: string | null;
      customer_display_name: string | null;
      guest_session_hash: string | null;
      order_access_token_hash: string;
      payment_status: string;
      fulfillment_status: string;
      subtotal_cents: string;
      discount_cents: string;
      total_cents: string;
      paid_at: string | null;
      delivered_at: string | null;
      created_at: string;
      reservation_status: string | null;
      reservation_expires_at: string | null;
    }>(
      `SELECT o.id, o.tenant_id, o.order_number, o.customer_user_id, o.customer_display_name,
              o.guest_session_hash, o.order_access_token_hash,
              o.payment_status, o.fulfillment_status,
              o.subtotal_cents, o.discount_cents, o.total_cents,
              o.paid_at, o.delivered_at, o.created_at,
              sr.status AS reservation_status,
              sr.expires_at AS reservation_expires_at
       FROM orders o
       LEFT JOIN stock_reservations sr ON sr.tenant_id = o.tenant_id AND sr.order_id = o.id
       WHERE o.id = $1
       LIMIT 1`,
      [params.orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: El pedido solicitado no existe.');
    }

    const authorizedByUser =
      Boolean(params.customerUserId) &&
      order.customer_user_id === params.customerUserId;
    const authorizedByGuestSession =
      Boolean(guestSessionHash) &&
      order.guest_session_hash === guestSessionHash &&
      (!order.customer_user_id || order.customer_user_id === params.customerUserId);
    const authorizedByAccessToken =
      Boolean(accessTokenHash) &&
      order.order_access_token_hash === accessTokenHash;

    if (!authorizedByUser && !authorizedByGuestSession && !authorizedByAccessToken) {
      throw new Error(
        'FORBIDDEN_ORDER_ACCESS: No tenés permiso para consultar el pedido o QR de otra persona.'
      );
    }

    const itemsRes = await tx.query<{
      id: string;
      product_id: string;
      product_name_snapshot: string;
      quantity: number;
      unit_price_cents: string;
      line_total_cents: string;
      substituted_product_name: string | null;
    }>(
      `SELECT id, product_id, product_name_snapshot, quantity,
              unit_price_cents, line_total_cents, substituted_product_name
       FROM order_items
       WHERE order_id = $1
       ORDER BY id ASC`,
      [order.id]
    );

    let qrData: AuthorizedCustomerOrderView['qr'] = null;
    if (order.payment_status === 'APPROVED') {
      const qrRes = await tx.query<{
        id: string;
        qr_raw_token: string;
        short_verification_code: string;
        status: 'ACTIVE' | 'STOCK_CONFLICT' | 'REDEEMED' | 'REVOKED_REFUND' | 'EXPIRED';
        issued_at: string;
        redeemed_at: string | null;
      }>(
        `SELECT id, qr_raw_token, short_verification_code, status, issued_at, redeemed_at
         FROM order_qrs
         WHERE order_id = $1
         LIMIT 1`,
        [order.id]
      );
      const q = qrRes.rows[0];
      if (q) {
        qrData = {
          qrId: q.id,
          qrRawToken: q.qr_raw_token,
          qrShortCode: q.short_verification_code,
          qrStatus: q.status,
          issuedAt: q.issued_at,
          redeemedAt: q.redeemed_at,
        };
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      tenantId: order.tenant_id,
      customerDisplayName: order.customer_display_name ?? 'Invitado',
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      subtotalCents: Number(order.subtotal_cents),
      discountCents: Number(order.discount_cents),
      totalCents: Number(order.total_cents),
      paidAt: order.paid_at,
      deliveredAt: order.delivered_at,
      createdAt: order.created_at,
      reservationStatus: order.reservation_status,
      reservationExpiresAt: order.reservation_expires_at,
      items: itemsRes.rows.map((it) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name_snapshot,
        quantity: Number(it.quantity),
        unitPriceCents: Number(it.unit_price_cents),
        lineTotalCents: Number(it.line_total_cents),
        substitutedByProductName: it.substituted_product_name,
      })),
      qr: qrData,
    };
  });
}

/**
 * Lista los pedidos recientes pertenecientes exclusivamente al comprador autenticado o sesión actual.
 */
export async function listAuthorizedCustomerOrders(params: {
  tenantId: string;
  customerUserId?: string | null;
  guestSessionToken?: string | null;
}): Promise<AuthorizedCustomerOrderView[]> {
  const guestSessionHash = params.guestSessionToken
    ? sha256Hex(params.guestSessionToken)
    : null;

  if (!params.customerUserId && !guestSessionHash) {
    return [];
  }

  const orderIds = await withTenantContext(params.tenantId, async (tx) => {
    const res = await tx.query<{ id: string }>(
      `SELECT id
       FROM orders
       WHERE (
         ($1::uuid IS NOT NULL AND customer_user_id = $1::uuid)
         OR ($2::varchar IS NOT NULL AND guest_session_hash = $2::varchar AND (customer_user_id IS NULL OR customer_user_id = $1::uuid))
       )
       ORDER BY created_at DESC
       LIMIT 10`,
      [params.customerUserId ?? null, guestSessionHash]
    );
    return res.rows.map((r) => r.id);
  });

  const results: AuthorizedCustomerOrderView[] = [];
  for (const orderId of orderIds) {
    try {
      const view = await getAuthorizedCustomerOrder({
        tenantId: params.tenantId,
        orderId,
        customerUserId: params.customerUserId,
        guestSessionToken: params.guestSessionToken,
      });
      results.push(view);
    } catch {
      // Ignorar si alguno no cumple condición
    }
  }
  return results;
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
