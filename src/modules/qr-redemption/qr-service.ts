import { withSuperadminContext, withTenantContext } from '@/db';
import { assertRolePermission, type TenantRole } from '@/modules/identity/rbac-service';
import { executeOrderRefundOrChargeback } from '@/modules/payments/mercadopago-service';
import { sha256Hex } from '@/modules/security/crypto-vault';

export interface QrOrderItemView {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  substitutedByProductName: string | null;
}

export interface InspectQrResponse {
  validTenantMatch: boolean;
  lookupOutcome:
    | 'READY_TO_REDEEM'
    | 'STOCK_CONFLICT_REQUIRES_RESOLUTION'
    | 'ALREADY_REDEEMED'
    | 'REVOKED_OR_REFUNDED'
    | 'WRONG_TENANT'
    | 'INVALID_TOKEN';
  qrId?: string;
  qrStatus?: string;
  shortVerificationCode?: string;
  orderId?: string;
  orderNumber?: string;
  customerDisplayName?: string;
  totalCents?: number;
  paidAt?: string;
  redeemedAt?: string | null;
  redeemedByStaffName?: string | null;
  redeemedAtStationName?: string | null;
  items?: QrOrderItemView[];
}

export async function inspectQrAtBar(params: {
  tenantId: string;
  actorRole: TenantRole;
  actorTenantUserId: string;
  stationId?: string | null;
  rawQrToken: string;
}): Promise<InspectQrResponse> {
  assertRolePermission(params.actorRole, 'bar:scan_and_redeem');

  const cleanToken = extractRawTokenFromQrInput(params.rawQrToken);
  const tokenHash = sha256Hex(cleanToken);
  const tokenPrefix = cleanToken.slice(0, 10);

  const localLookup = await withTenantContext(params.tenantId, async (tx) => {
    const qrRes = await tx.query<{
      qr_id: string;
      qr_status: string;
      short_verification_code: string;
      redeemed_at: string | null;
      staff_display_name: string | null;
      station_name: string | null;
      order_id: string;
      order_number: string;
      customer_display_name: string | null;
      total_cents: string;
      paid_at: string | null;
    }>(
      `SELECT q.id AS qr_id, q.status AS qr_status, q.short_verification_code,
              q.redeemed_at,
              tu.staff_display_name,
              bs.name AS station_name,
              o.id AS order_id, o.order_number, o.customer_display_name,
              o.total_cents, o.paid_at
       FROM order_qrs q
       INNER JOIN orders o ON o.tenant_id = q.tenant_id AND o.id = q.order_id
       LEFT JOIN tenant_users tu ON tu.tenant_id = q.tenant_id AND tu.id = q.redeemed_by_tenant_user_id
       LEFT JOIN bar_stations bs ON bs.tenant_id = q.tenant_id AND bs.id = q.redeemed_at_station_id
       WHERE q.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    const qr = qrRes.rows[0];
    if (!qr) return null;

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
      [qr.order_id]
    );

    if (qr.qr_status === 'STOCK_CONFLICT') {
      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, order_qr_id, attempted_token_prefix,
           tenant_user_id, station_id, attempt_result, details
         ) VALUES ($1, $2, $3, $4, $5, 'STOCK_CONFLICT_PROMPTED', 'Escaneo de QR con conflicto de stock tardío')`,
        [
          params.tenantId,
          qr.qr_id,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
        ]
      );
    }

    return {
      qr,
      items: itemsRes.rows.map((it) => ({
        id: it.id,
        productId: it.product_id,
        productName: it.product_name_snapshot,
        quantity: Number(it.quantity),
        unitPriceCents: Number(it.unit_price_cents),
        lineTotalCents: Number(it.line_total_cents),
        substitutedByProductName: it.substituted_product_name,
      })),
    };
  });

  if (!localLookup) {
    // Verificamos si pertenece a otro boliche para auditar intento cruzado (REJECTED_WRONG_TENANT)
    const existsInOtherTenant = await withSuperadminContext(async (tx) => {
      const checkRes = await tx.query<{ tenant_id: string }>(
        `SELECT tenant_id FROM order_qrs WHERE token_hash = $1 LIMIT 1`,
        [tokenHash]
      );
      const foundTenant = checkRes.rows[0]?.tenant_id;
      return Boolean(foundTenant && foundTenant !== params.tenantId);
    });

    await withTenantContext(params.tenantId, async (tx) => {
      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, attempted_token_prefix, tenant_user_id, station_id, attempt_result, details
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          params.tenantId,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          existsInOtherTenant ? 'REJECTED_WRONG_TENANT' : 'REJECTED_INVALID_TOKEN',
          existsInOtherTenant
            ? 'Intento de escanear un QR emitido para otro establecimiento'
            : 'Token QR inexistente',
        ]
      );
    });

    return {
      validTenantMatch: false,
      lookupOutcome: existsInOtherTenant ? 'WRONG_TENANT' : 'INVALID_TOKEN',
    };
  }

  const { qr, items } = localLookup;
  const lookupOutcome: InspectQrResponse['lookupOutcome'] =
    qr.qr_status === 'ACTIVE'
      ? 'READY_TO_REDEEM'
      : qr.qr_status === 'STOCK_CONFLICT'
        ? 'STOCK_CONFLICT_REQUIRES_RESOLUTION'
        : qr.qr_status === 'REDEEMED'
          ? 'ALREADY_REDEEMED'
          : 'REVOKED_OR_REFUNDED';

  return {
    validTenantMatch: true,
    lookupOutcome,
    qrId: qr.qr_id,
    qrStatus: qr.qr_status,
    shortVerificationCode: qr.short_verification_code,
    orderId: qr.order_id,
    orderNumber: qr.order_number,
    customerDisplayName: qr.customer_display_name ?? 'Invitado',
    totalCents: Number(qr.total_cents),
    paidAt: qr.paid_at ?? undefined,
    redeemedAt: qr.redeemed_at,
    redeemedByStaffName: qr.staff_display_name,
    redeemedAtStationName: qr.station_name,
    items,
  };
}

export interface RedeemQrResult {
  success: boolean;
  outcome:
    | 'REDEEMED_SUCCESSFULLY'
    | 'REJECTED_ALREADY_REDEEMED'
    | 'REJECTED_STOCK_CONFLICT'
    | 'REJECTED_REVOKED_OR_INVALID';
  orderId?: string;
  orderNumber?: string;
  redeemedAt?: string;
  previousRedemption?: {
    redeemedAt: string | null;
    redeemedByStaffName: string | null;
    stationName: string | null;
  };
}

/**
 * Ejecuta el quemado atómico del QR en barra mediante una actualización condicional:
 * `UPDATE order_qrs SET status = 'REDEEMED' ... WHERE token_hash = $1 AND status = 'ACTIVE' RETURNING ...`
 * Impide de raíz cualquier entrega doble ante escaneos simultáneos en distintas barras.
 */
export async function redeemQrAtBarAtomically(params: {
  tenantId: string;
  actorRole: TenantRole;
  actorTenantUserId: string;
  stationId?: string | null;
  rawQrToken: string;
  now?: Date;
}): Promise<RedeemQrResult> {
  assertRolePermission(params.actorRole, 'bar:scan_and_redeem');

  const cleanToken = extractRawTokenFromQrInput(params.rawQrToken);
  const tokenHash = sha256Hex(cleanToken);
  const tokenPrefix = cleanToken.slice(0, 10);
  const nowIso = (params.now ?? new Date()).toISOString();

  return withTenantContext(params.tenantId, async (tx) => {
    // 1. UPDATE atómico condicional: solo 1 transacción puede transicionar de ACTIVE a REDEEMED
    const updateRes = await tx.query<{
      id: string;
      order_id: string;
      redeemed_at: string;
    }>(
      `UPDATE order_qrs
       SET status = 'REDEEMED',
           redeemed_at = $2,
           redeemed_by_tenant_user_id = $3,
           redeemed_at_station_id = $4
       WHERE token_hash = $1
         AND status = 'ACTIVE'
       RETURNING id, order_id, redeemed_at`,
      [
        tokenHash,
        nowIso,
        params.actorTenantUserId,
        params.stationId ?? null,
      ]
    );

    if (updateRes.rowCount === 1 && updateRes.rows[0]) {
      const burnedQr = updateRes.rows[0];

      const orderUpdateRes = await tx.query<{ order_number: string }>(
        `UPDATE orders
         SET fulfillment_status = 'DELIVERED',
             delivered_at = $2,
             updated_at = $2
         WHERE id = $1
         RETURNING order_number`,
        [burnedQr.order_id, nowIso]
      );

      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, order_qr_id, attempted_token_prefix,
           tenant_user_id, station_id, attempt_result, details, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS_REDEEMED', 'Entrega confirmada en barra', $6)`,
        [
          params.tenantId,
          burnedQr.id,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          nowIso,
        ]
      );

      return {
        success: true,
        outcome: 'REDEEMED_SUCCESSFULLY',
        orderId: burnedQr.order_id,
        orderNumber: orderUpdateRes.rows[0]?.order_number,
        redeemedAt: burnedQr.redeemed_at,
      };
    }

    // 2. Si el UPDATE condicional devolvió 0 filas, inspeccionamos por qué falló dentro de la misma transacción
    const existingRes = await tx.query<{
      id: string;
      order_id: string;
      status: string;
      redeemed_at: string | null;
      staff_display_name: string | null;
      station_name: string | null;
    }>(
      `SELECT q.id, q.order_id, q.status, q.redeemed_at,
              tu.staff_display_name,
              bs.name AS station_name
       FROM order_qrs q
       LEFT JOIN tenant_users tu ON tu.tenant_id = q.tenant_id AND tu.id = q.redeemed_by_tenant_user_id
       LEFT JOIN bar_stations bs ON bs.tenant_id = q.tenant_id AND bs.id = q.redeemed_at_station_id
       WHERE q.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    const existing = existingRes.rows[0];
    if (!existing) {
      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, attempted_token_prefix, tenant_user_id, station_id, attempt_result, details, created_at
         ) VALUES ($1, $2, $3, $4, 'REJECTED_INVALID_TOKEN', 'Intento de canje con token inexistente o de otro boliche', $5)`,
        [
          params.tenantId,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          nowIso,
        ]
      );
      return {
        success: false,
        outcome: 'REJECTED_REVOKED_OR_INVALID',
      };
    }

    if (existing.status === 'REDEEMED') {
      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, order_qr_id, attempted_token_prefix,
           tenant_user_id, station_id, attempt_result, details, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'REJECTED_ALREADY_REDEEMED', 'Doble intento de canje bloqueado atómicamente', $6)`,
        [
          params.tenantId,
          existing.id,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          nowIso,
        ]
      );

      return {
        success: false,
        outcome: 'REJECTED_ALREADY_REDEEMED',
        orderId: existing.order_id,
        previousRedemption: {
          redeemedAt: existing.redeemed_at,
          redeemedByStaffName: existing.staff_display_name ?? 'Staff Barra',
          stationName: existing.station_name ?? 'Barra Principal',
        },
      };
    }

    if (existing.status === 'STOCK_CONFLICT') {
      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, order_qr_id, attempted_token_prefix,
           tenant_user_id, station_id, attempt_result, details, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'STOCK_CONFLICT_PROMPTED', 'Intento de canje directo sobre QR en conflicto de stock', $6)`,
        [
          params.tenantId,
          existing.id,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          nowIso,
        ]
      );

      return {
        success: false,
        outcome: 'REJECTED_STOCK_CONFLICT',
        orderId: existing.order_id,
      };
    }

    await tx.query(
      `INSERT INTO qr_redemption_logs (
         tenant_id, order_qr_id, attempted_token_prefix,
         tenant_user_id, station_id, attempt_result, details, created_at
       ) VALUES ($1, $2, $3, $4, $5, 'REJECTED_REVOKED_OR_REFUNDED', 'Intento de canje sobre QR revocado o reembolsado', $6)`,
      [
        params.tenantId,
        existing.id,
        tokenPrefix,
        params.actorTenantUserId,
        params.stationId ?? null,
        nowIso,
      ]
    );

    return {
      success: false,
      outcome: 'REJECTED_REVOKED_OR_INVALID',
      orderId: existing.order_id,
    };
  });
}

/**
 * Resuelve en barra un QR en estado `STOCK_CONFLICT` (cuando MP aprobó el pago después de vencida la reserva
 * y otro cliente compró la última unidad):
 * - Opción `SUBSTITUTE`: Descuenta stock del producto sustituto elegido y quema el QR como entregado.
 * - Opción `REFUND`: Dispara reembolso del 100% vía Mercado Pago, revoca el QR y descuenta la comisión en el ledger.
 */
export async function resolveStockConflictAtBar(params: {
  tenantId: string;
  actorRole: TenantRole;
  actorTenantUserId: string;
  actorUserId?: string;
  stationId?: string | null;
  rawQrToken: string;
  resolution:
    | {
        action: 'SUBSTITUTE';
        orderItemId: string;
        substituteProductId: string;
        notes?: string;
      }
    | {
        action: 'REFUND';
        reason?: string;
      };
}): Promise<{
  resolvedAction: 'SUBSTITUTE' | 'REFUND';
  orderId: string;
  qrStatus: 'REDEEMED' | 'REVOKED_REFUND';
  orderFulfillmentStatus: 'RESOLVED_WITH_SUBSTITUTE' | 'CANCELLED_REFUNDED';
}> {
  assertRolePermission(params.actorRole, 'bar:resolve_conflict');

  const cleanToken = extractRawTokenFromQrInput(params.rawQrToken);
  const tokenHash = sha256Hex(cleanToken);
  const tokenPrefix = cleanToken.slice(0, 10);

  if (params.resolution.action === 'SUBSTITUTE') {
    const subParams = params.resolution;
    return withTenantContext(params.tenantId, async (tx) => {
      const qrRes = await tx.query<{
        id: string;
        order_id: string;
        status: string;
      }>(
        `SELECT id, order_id, status
         FROM order_qrs
         WHERE token_hash = $1
         FOR UPDATE`,
        [tokenHash]
      );
      const qr = qrRes.rows[0];
      if (!qr || qr.status !== 'STOCK_CONFLICT') {
        throw new Error('El QR no se encuentra en estado STOCK_CONFLICT.');
      }

      const itemRes = await tx.query<{ id: string; quantity: number }>(
        `SELECT id, quantity
         FROM order_items
         WHERE id = $1 AND order_id = $2
         FOR UPDATE`,
        [subParams.orderItemId, qr.order_id]
      );
      const orderItem = itemRes.rows[0];
      if (!orderItem) {
        throw new Error('Ítem del pedido no encontrado para sustitución.');
      }

      const subProdRes = await tx.query<{
        id: string;
        name: string;
        stock_total: number;
        stock_reserved: number;
        stock_sold: number;
      }>(
        `SELECT id, name, stock_total, stock_reserved, stock_sold
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [subParams.substituteProductId]
      );
      const subProd = subProdRes.rows[0];
      if (!subProd) {
        throw new Error('Producto sustituto no encontrado en este boliche.');
      }

      const freeSubStock =
        Number(subProd.stock_total) -
        Number(subProd.stock_reserved) -
        Number(subProd.stock_sold);
      const qtyNeeded = Number(orderItem.quantity);
      if (freeSubStock < qtyNeeded) {
        throw new Error(
          `El producto sustituto "${subProd.name}" tampoco tiene stock suficiente (${freeSubStock} disponibles).`
        );
      }

      await tx.query(
        `UPDATE products
         SET stock_sold = stock_sold + $2,
             version = version + 1,
             updated_at = now()
         WHERE id = $1`,
        [subProd.id, qtyNeeded]
      );

      await tx.query(
        `UPDATE order_items
         SET substituted_by_product_id = $2,
             substituted_product_name = $3,
             substitution_notes = $4
         WHERE id = $1`,
        [
          orderItem.id,
          subProd.id,
          subProd.name,
          subParams.notes ?? 'Sustitución autorizada en barra por conflicto de stock tardío',
        ]
      );

      await tx.query(
        `UPDATE order_qrs
         SET status = 'REDEEMED',
             redeemed_at = now(),
             redeemed_by_tenant_user_id = $2,
             redeemed_at_station_id = $3
         WHERE id = $1`,
        [qr.id, params.actorTenantUserId, params.stationId ?? null]
      );

      await tx.query(
        `UPDATE orders
         SET fulfillment_status = 'RESOLVED_WITH_SUBSTITUTE',
             delivered_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [qr.order_id]
      );

      await tx.query(
        `INSERT INTO qr_redemption_logs (
           tenant_id, order_qr_id, attempted_token_prefix,
           tenant_user_id, station_id, attempt_result, details
         ) VALUES ($1, $2, $3, $4, $5, 'SUCCESS_SUBSTITUTED', $6)`,
        [
          params.tenantId,
          qr.id,
          tokenPrefix,
          params.actorTenantUserId,
          params.stationId ?? null,
          `Entregado sustituto: ${subProd.name}`,
        ]
      );

      return {
        resolvedAction: 'SUBSTITUTE',
        orderId: qr.order_id,
        qrStatus: 'REDEEMED',
        orderFulfillmentStatus: 'RESOLVED_WITH_SUBSTITUTE',
      };
    });
  }

  // Opción REFUND en 1 clic desde la barra
  const qrInfo = await withTenantContext(params.tenantId, async (tx) => {
    const res = await tx.query<{
      qr_id: string;
      order_id: string;
      status: string;
      total_cents: string;
    }>(
      `SELECT q.id AS qr_id, q.order_id, q.status, o.total_cents
       FROM order_qrs q
       INNER JOIN orders o ON o.tenant_id = q.tenant_id AND o.id = q.order_id
       WHERE q.token_hash = $1`,
      [tokenHash]
    );
    return res.rows[0] ?? null;
  });

  if (!qrInfo || qrInfo.status !== 'STOCK_CONFLICT') {
    throw new Error('El QR no se encuentra en estado STOCK_CONFLICT para reembolsar.');
  }

  await executeOrderRefundOrChargeback({
    tenantId: params.tenantId,
    actorRole: params.actorRole,
    actorUserId: params.actorUserId,
    orderId: qrInfo.order_id,
    amountCents: Number(qrInfo.total_cents),
    refundType: 'STOCK_CONFLICT_REFUND',
    reason:
      params.resolution.reason ??
      'Reembolso 100% en barra por falta de stock ante confirmación tardía de Mercado Pago',
  });

  return {
    resolvedAction: 'REFUND',
    orderId: qrInfo.order_id,
    qrStatus: 'REVOKED_REFUND',
    orderFulfillmentStatus: 'CANCELLED_REFUNDED',
  };
}

export function extractRawTokenFromQrInput(qrInput: string): string {
  const trimmed = qrInput.trim();
  if (trimmed.includes('/r/')) {
    const afterSlash = trimmed.split('/r/').pop() ?? '';
    return (afterSlash.split('?')[0] ?? '').trim();
  }
  return trimmed;
}
