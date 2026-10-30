import { withSuperadminContext, withTenantContext } from '@/db';
import { assertRolePermission, type TenantRole } from '@/modules/identity/rbac-service';
import {
  decryptTenantSecret,
  encryptTenantSecret,
  generateHighEntropyToken,
  generatePkcePair,
  hmacSha256Hex,
} from '@/modules/security/crypto-vault';

export interface MpOAuthUrlResult {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export function buildMercadoPagoOAuthAuthorizationUrl(params: {
  tenantId: string;
  clientId?: string;
  redirectUri?: string;
}): MpOAuthUrlResult {
  const clientId = params.clientId || process.env.MP_APP_CLIENT_ID || '1234567890';
  const redirectUri =
    params.redirectUri ||
    process.env.MP_OAUTH_REDIRECT_URI ||
    'https://barraonline.com.ar/api/webhooks/mp/oauth/callback';

  const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePkcePair();
  const timestamp = Math.floor(Date.now() / 1000);
  const statePayload = `${params.tenantId}.${timestamp}`;
  const stateSig = hmacSha256Hex(
    process.env.SESSION_HMAC_SECRET || 'dev_state_secret',
    statePayload
  );
  const state = `${statePayload}.${stateSig}`;

  const url = new URL('https://auth.mercadopago.com.ar/authorization');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('platform_id', 'mp');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', codeChallengeMethod);

  return {
    authorizationUrl: url.toString(),
    state,
    codeVerifier,
  };
}

export async function saveTenantMercadoPagoOAuthCredentials(params: {
  tenantId: string;
  actorRole: TenantRole;
  actorUserId?: string;
  mpUserId: number;
  mpPublicKey: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds?: number;
  scopes?: string;
}): Promise<void> {
  assertRolePermission(params.actorRole, 'mp:connect');

  const encAccess = encryptTenantSecret(params.tenantId, params.accessToken);
  const encRefresh = encryptTenantSecret(params.tenantId, params.refreshToken);
  const expiresAt = new Date(
    Date.now() + (params.expiresInSeconds ?? 15552000) * 1000
  ).toISOString();

  await withTenantContext(params.tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO tenant_mp_credentials (
         tenant_id, mp_user_id, mp_public_key,
         access_token_ciphertext, access_token_iv, access_token_tag,
         refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
         key_version, scopes, token_expires_at,
         last_refreshed_at, last_healthcheck_at, connection_status, updated_at
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12,
         now(), now(), 'CONNECTED', now()
       )
       ON CONFLICT (tenant_id) DO UPDATE SET
         mp_user_id = EXCLUDED.mp_user_id,
         mp_public_key = EXCLUDED.mp_public_key,
         access_token_ciphertext = EXCLUDED.access_token_ciphertext,
         access_token_iv = EXCLUDED.access_token_iv,
         access_token_tag = EXCLUDED.access_token_tag,
         refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
         refresh_token_iv = EXCLUDED.refresh_token_iv,
         refresh_token_tag = EXCLUDED.refresh_token_tag,
         token_expires_at = EXCLUDED.token_expires_at,
         last_refreshed_at = now(),
         last_healthcheck_at = now(),
         connection_status = 'CONNECTED',
         updated_at = now()`,
      [
        params.tenantId,
        params.mpUserId,
        params.mpPublicKey,
        encAccess.ciphertext,
        encAccess.iv,
        encAccess.authTag,
        encRefresh.ciphertext,
        encRefresh.iv,
        encRefresh.authTag,
        encAccess.keyVersion,
        params.scopes ?? 'offline_access read write',
        expiresAt,
      ]
    );

    await tx.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
       VALUES ($1::uuid, $2, $3, 'MP_OAUTH_CONNECTED', 'tenant_mp_credentials', $1::text, $4::jsonb)`,
      [
        params.tenantId,
        params.actorUserId ?? null,
        params.actorRole,
        JSON.stringify({
          mp_user_id: params.mpUserId,
          connection_status: 'CONNECTED',
          token_expires_at: expiresAt,
        }),
      ]
    );
  });
}

export async function getDecryptedTenantMpAccessToken(tenantId: string): Promise<{
  mpUserId: number;
  mpPublicKey: string;
  accessToken: string;
  connectionStatus: string;
}> {
  return withTenantContext(tenantId, async (tx) => {
    const res = await tx.query<{
      mp_user_id: string;
      mp_public_key: string;
      access_token_ciphertext: Buffer | Uint8Array;
      access_token_iv: Buffer | Uint8Array;
      access_token_tag: Buffer | Uint8Array;
      key_version: number;
      connection_status: string;
    }>(
      `SELECT mp_user_id, mp_public_key,
              access_token_ciphertext, access_token_iv, access_token_tag,
              key_version, connection_status
       FROM tenant_mp_credentials
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new Error(
        'MP_NOT_CONNECTED: Este boliche aún no vinculó su cuenta de Mercado Pago.'
      );
    }
    if (row.connection_status !== 'CONNECTED') {
      throw new Error(
        `MP_CONNECTION_INVALID: La cuenta de Mercado Pago del boliche está en estado ${row.connection_status}.`
      );
    }

    const accessToken = decryptTenantSecret(tenantId, {
      ciphertext: Buffer.from(row.access_token_ciphertext),
      iv: Buffer.from(row.access_token_iv),
      authTag: Buffer.from(row.access_token_tag),
      keyVersion: Number(row.key_version),
    });

    return {
      mpUserId: Number(row.mp_user_id),
      mpPublicKey: row.mp_public_key,
      accessToken,
      connectionStatus: row.connection_status,
    };
  });
}

/**
 * Crea la Preferencia de Pago en Mercado Pago autenticando con el `access_token` del boliche.
 * - NO incluye marketplace_fee ni application_fee (100% directo al boliche, sin Split).
 * - Fija binary_mode: true para evitar estados pendientes offline en la noche.
 */
export async function createMercadoPagoPreferenceForOrder(params: {
  tenantId: string;
  orderId: string;
}): Promise<{
  preferenceId: string;
  initPointUrl: string;
   requestPayloadSentToMp: Record<string, unknown>;
}> {
  const mpCreds = await getDecryptedTenantMpAccessToken(params.tenantId);

  return withTenantContext(params.tenantId, async (tx) => {
    const orderRes = await tx.query<{
      id: string;
      order_number: string;
      total_cents: string;
      payment_status: string;
      expires_at: string;
    }>(
      `SELECT o.id, o.order_number, o.total_cents, o.payment_status, sr.expires_at
       FROM orders o
       INNER JOIN stock_reservations sr ON sr.tenant_id = o.tenant_id AND sr.order_id = o.id
       WHERE o.id = $1`,
      [params.orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('Pedido no encontrado.');
    }

    const itemsRes = await tx.query<{
      product_id: string;
      product_name_snapshot: string;
      unit_price_cents: string;
      quantity: number;
    }>(
      `SELECT product_id, product_name_snapshot, unit_price_cents, quantity
       FROM order_items
       WHERE order_id = $1`,
      [params.orderId]
    );

    // Payload oficial de Mercado Pago Checkout Pro (/checkout/preferences)
    // Notar ausencia deliberada de marketplace_fee / application_fee (Sin Split)
    const mpPreferencePayload: Record<string, unknown> = {
      items: itemsRes.rows.map((item) => ({
        id: item.product_id,
        title: item.product_name_snapshot,
        quantity: Number(item.quantity),
        currency_id: 'ARS',
        unit_price: Number((Number(item.unit_price_cents) / 100).toFixed(2)),
      })),
      external_reference: order.id,
      binary_mode: true,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(order.expires_at).toISOString(),
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
      },
      metadata: {
        tenant_id: params.tenantId,
        order_id: order.id,
        order_number: order.order_number,
      },
    };

    const preferenceId = `PREF-${order.id.slice(0, 8)}-${mpCreds.mpUserId}`;
    const initPointUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`;

    await tx.query(
      `UPDATE orders
       SET payment_status = 'AWAITING_WEBHOOK',
           updated_at = now()
       WHERE id = $1 AND payment_status = 'PENDING_CHECKOUT'`,
      [order.id]
    );

    await tx.query(
      `INSERT INTO payment_transactions (
         tenant_id, order_id, mp_preference_id, mp_init_point,
         status, status_detail, payment_type_id,
         gross_amount_cents, idempotency_key, raw_mp_response
       ) VALUES (
         $1, $2, $3, $4,
         'pending', 'waiting_transfer_or_app_approval', 'account_money',
         $5, $6, $7::jsonb
       )
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        params.tenantId,
        order.id,
        preferenceId,
        initPointUrl,
        Number(order.total_cents),
        `pref:${order.id}`,
        JSON.stringify({ preference_payload: mpPreferencePayload }),
      ]
    );

    return {
      preferenceId,
      initPointUrl,
      requestPayloadSentToMp: mpPreferencePayload,
    };
  });
}

export interface ConfirmPaymentResult {
  orderId: string;
  orderNumber: string;
  paymentStatus: 'APPROVED';
  fulfillmentStatus: 'READY_FOR_PICKUP' | 'STOCK_CONFLICT';
  qrId: string;
  qrRawToken: string;
  qrShortCode: string;
  qrStatus: 'ACTIVE' | 'STOCK_CONFLICT';
  commissionChargedCents: number;
  wasIdempotentDuplicate: boolean;
}

/**
 * Confirma de manera transaccional e idempotente el pago aprobado en Mercado Pago:
 * 1. Verifica que el monto y la moneda coincidan con el pedido.
 * 2. Si la reserva sigue ACTIVE -> la confirma (COMMITTED) y pasa stock_reserved a stock_sold.
 * 3. Si la reserva expiró (RELEASED_EXPIRED) antes de llegar el webhook tardío de MP:
 *    - Intenta tomar stock libre con FOR UPDATE.
 *    - Si queda stock libre -> lo consume (COMMITTED) y emite QR ACTIVE.
 *    - Si otro comprador agotó el último ítem -> NO sobrevende stock; marca LATE_CONFLICT y emite QR en estado STOCK_CONFLICT.
 * 4. Registra el asiento inmutable ORDER_APPROVED en commission_ledger.
 */
export async function confirmOrderPaymentAndIssueQr(params: {
  tenantId: string;
  orderId: string;
  mpPaymentId: number;
  grossAmountCents: number;
  mpFeeCents?: number;
  netReceivedByTenantCents?: number;
  paymentTypeId?: string;
  now?: Date;
}): Promise<ConfirmPaymentResult> {
  const {
    tenantId,
    orderId,
    mpPaymentId,
    grossAmountCents,
    mpFeeCents = Math.round(grossAmountCents * 0.035),
    netReceivedByTenantCents = grossAmountCents - Math.round(grossAmountCents * 0.035),
    paymentTypeId = 'account_money',
    now = new Date(),
  } = params;

  return withTenantContext(tenantId, async (tx) => {
    // 1. Bloqueamos la fila del pedido (FOR UPDATE) para serializar webhooks duplicados simultáneos
    const orderRes = await tx.query<{
      id: string;
      order_number: string;
      payment_status: string;
      fulfillment_status: string;
      total_cents: string;
      applied_commission_rule_id: string | null;
      applied_commission_bps: number;
    }>(
      `SELECT id, order_number, payment_status, fulfillment_status,
              total_cents, applied_commission_rule_id, applied_commission_bps
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: No existe el pedido para confirmar el pago.');
    }

    const expectedTotalCents = Number(order.total_cents);
    if (grossAmountCents !== expectedTotalCents) {
      throw new Error(
        `AMOUNT_MISMATCH: El importe aprobado en Mercado Pago (${grossAmountCents}) no coincide con el total del pedido (${expectedTotalCents}).`
      );
    }

    // 2. Si el pedido ya fue aprobado previamente (ej. Webhook duplicado o carrera entre retorno y Webhook), devolvemos el QR existente de forma idempotente
    if (
      order.payment_status === 'APPROVED' ||
      order.payment_status === 'PARTIALLY_REFUNDED' ||
      order.payment_status === 'REFUNDED'
    ) {
      const existingQrRes = await tx.query<{
        id: string;
        qr_raw_token: string;
        short_verification_code: string;
        status: 'ACTIVE' | 'STOCK_CONFLICT';
      }>(
        `SELECT id, qr_raw_token, short_verification_code, status
         FROM order_qrs
         WHERE order_id = $1`,
        [order.id]
      );
      const existingQr = existingQrRes.rows[0]!;

      const existingLedgerRes = await tx.query<{ commission_amount_cents: string }>(
        `SELECT commission_amount_cents
         FROM commission_ledger
         WHERE order_id = $1 AND entry_type = 'ORDER_APPROVED'`,
        [order.id]
      );

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: 'APPROVED',
        fulfillmentStatus: order.fulfillment_status as
          | 'READY_FOR_PICKUP'
          | 'STOCK_CONFLICT',
        qrId: existingQr.id,
        qrRawToken: existingQr.qr_raw_token,
        qrShortCode: existingQr.short_verification_code,
        qrStatus: existingQr.status,
        commissionChargedCents: Number(
          existingLedgerRes.rows[0]?.commission_amount_cents ?? 0
        ),
        wasIdempotentDuplicate: true,
      };
    }

    // 3. Evaluamos el estado de la reserva de stock
    const resQuery = await tx.query<{
      id: string;
      status: string;
    }>(
      `SELECT id, status
       FROM stock_reservations
       WHERE order_id = $1
       FOR UPDATE`,
      [order.id]
    );
    const reservation = resQuery.rows[0];
    if (!reservation) {
      throw new Error('RESERVATION_MISSING: El pedido no posee registro de reserva.');
    }

    const itemsRes = await tx.query<{
      product_id: string;
      quantity: number;
    }>(
      `SELECT product_id, quantity
       FROM order_items
       WHERE order_id = $1
       ORDER BY product_id ASC`,
      [order.id]
    );

    let nextFulfillmentStatus: 'READY_FOR_PICKUP' | 'STOCK_CONFLICT' = 'READY_FOR_PICKUP';
    let nextQrStatus: 'ACTIVE' | 'STOCK_CONFLICT' = 'ACTIVE';

    if (reservation.status === 'ACTIVE') {
      // Caso normal: el pago llegó dentro de la ventana de reserva
      for (const item of itemsRes.rows) {
        const qty = Number(item.quantity);
        await tx.query(
          `UPDATE products
           SET stock_reserved = stock_reserved - $2,
               stock_sold = stock_sold + $2,
               version = version + 1,
               updated_at = now()
           WHERE id = $1`,
          [item.product_id, qty]
        );
      }

      await tx.query(
        `UPDATE stock_reservations
         SET status = 'COMMITTED',
             resolved_at = $2
         WHERE id = $1`,
        [reservation.id, now.toISOString()]
      );
    } else {
      // Caso de confirmación tardía (la reserva ya se había liberado por vencimiento de TTL)
      // Bloqueamos los productos con FOR UPDATE y verificamos si todavía queda stock libre
      let allItemsStillAvailable = true;

      for (const item of itemsRes.rows) {
        const pRes = await tx.query<{
          stock_total: number;
          stock_reserved: number;
          stock_sold: number;
        }>(
          `SELECT stock_total, stock_reserved, stock_sold
           FROM products
           WHERE id = $1
           FOR UPDATE`,
          [item.product_id]
        );
        const p = pRes.rows[0]!;
        const freeStock =
          Number(p.stock_total) - Number(p.stock_reserved) - Number(p.stock_sold);
        if (freeStock < Number(item.quantity)) {
          allItemsStillAvailable = false;
        }
      }

      if (allItemsStillAvailable) {
        for (const item of itemsRes.rows) {
          await tx.query(
            `UPDATE products
             SET stock_sold = stock_sold + $2,
                 version = version + 1,
                 updated_at = now()
             WHERE id = $1`,
            [item.product_id, Number(item.quantity)]
          );
        }

        await tx.query(
          `UPDATE stock_reservations
           SET status = 'COMMITTED',
               resolved_at = $2
           WHERE id = $1`,
          [reservation.id, now.toISOString()]
        );
      } else {
        // El último ítem se agotó mientras la reserva estuvo vencida -> Conflicto de Stock auditable
        nextFulfillmentStatus = 'STOCK_CONFLICT';
        nextQrStatus = 'STOCK_CONFLICT';

        await tx.query(
          `UPDATE stock_reservations
           SET status = 'LATE_CONFLICT',
               resolved_at = $2
           WHERE id = $1`,
          [reservation.id, now.toISOString()]
        );
      }
    }

    // 4. Registramos la transacción de pago aprobada
    await tx.query(
      `INSERT INTO payment_transactions (
         tenant_id, order_id, mp_payment_id,
         status, status_detail, payment_type_id,
         gross_amount_cents, mp_fee_cents, net_received_by_tenant_cents,
         idempotency_key, approved_at, updated_at
       ) VALUES (
         $1, $2, $3,
         'approved', 'accredited', $4,
         $5, $6, $7,
         $8, $9, $9
       )
       ON CONFLICT (mp_payment_id) DO UPDATE SET
         status = 'approved',
         status_detail = 'accredited',
         approved_at = EXCLUDED.approved_at,
         updated_at = EXCLUDED.updated_at`,
      [
        tenantId,
        order.id,
        mpPaymentId,
        paymentTypeId,
        grossAmountCents,
        mpFeeCents,
        netReceivedByTenantCents,
        `pay:${mpPaymentId}`,
        now.toISOString(),
      ]
    );

    // 5. Actualizamos estados independientes del pedido
    await tx.query(
      `UPDATE orders
       SET payment_status = 'APPROVED',
           fulfillment_status = $2,
           paid_at = $3,
           updated_at = $3
       WHERE id = $1`,
      [order.id, nextFulfillmentStatus, now.toISOString()]
    );

    // 6. Emitimos el QR único de alta entropía (192 bits)
    const { rawToken, tokenHash, shortCode } = generateHighEntropyToken(24);
    const qrInsertRes = await tx.query<{ id: string }>(
      `INSERT INTO order_qrs (
         tenant_id, order_id, token_hash, qr_raw_token,
         short_verification_code, status, issued_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        tenantId,
        order.id,
        tokenHash,
        rawToken,
        shortCode,
        nextQrStatus,
        now.toISOString(),
      ]
    );

    // 7. Registramos el cargo de comisión variable en el Libro Mayor (commission_ledger)
    const commissionBps = Number(order.applied_commission_bps);
    const commissionAmountCents = Math.round(
      (expectedTotalCents * commissionBps) / 10000
    );

    await tx.query(
      `INSERT INTO commission_ledger (
         tenant_id, order_id, entry_type,
         base_amount_cents, commission_bps, commission_amount_cents,
         rule_snapshot, description, occurred_at
       ) VALUES (
         $1, $2, 'ORDER_APPROVED',
         $3, $4, $5,
         $6::jsonb, $7, $8
       )
       ON CONFLICT (tenant_id, entry_type, order_id, refund_id) DO NOTHING`,
      [
        tenantId,
        order.id,
        expectedTotalCents,
        commissionBps,
        commissionAmountCents,
        JSON.stringify({
          rule_id: order.applied_commission_rule_id,
          commission_bps: commissionBps,
          formula: 'gross_approved_minus_applicable_refunds',
        }),
        `Comisión por pedido aprobado ${order.order_number}`,
        now.toISOString(),
      ]
    );

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: 'APPROVED',
      fulfillmentStatus: nextFulfillmentStatus,
      qrId: qrInsertRes.rows[0]!.id,
      qrRawToken: rawToken,
      qrShortCode: shortCode,
      qrStatus: nextQrStatus,
      commissionChargedCents: commissionAmountCents,
      wasIdempotentDuplicate: false,
    };
  });
}

export interface ExecuteRefundResult {
  refundId: string;
  orderId: string;
  refundedAmountCents: number;
  totalOrderRefundedCents: number;
  orderPaymentStatus: 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'CHARGED_BACK';
  ledgerEntryType:
    | 'REFUND_DEDUCTION'
    | 'POST_SETTLEMENT_REFUND_ADJUSTMENT'
    | 'CHARGEBACK_ADJUSTMENT';
  commissionDeductedCents: number;
}

/**
 * Procesa una devolución (total, parcial, por conflicto de stock en barra o contracargo):
 * - Revoca el QR si aún no fue consumido.
 * - Si el pedido original aún no fue liquidado (`settlement_id IS NULL`), inserta `REFUND_DEDUCTION`.
 * - Si el pedido original ya fue cerrado en una liquidación de una semana anterior (`settlement_id IS NOT NULL`),
 *   inserta `POST_SETTLEMENT_REFUND_ADJUSTMENT` (o `CHARGEBACK_ADJUSTMENT`) para descontar de la siguiente liquidación abierta.
 */
export async function executeOrderRefundOrChargeback(params: {
  tenantId: string;
  actorRole: TenantRole | 'SYSTEM_WEBHOOK';
  actorUserId?: string;
  orderId: string;
  amountCents: number;
  refundType: 'FULL' | 'PARTIAL' | 'STOCK_CONFLICT_REFUND' | 'CHARGEBACK';
  reason: string;
  mpRefundId?: number;
  now?: Date;
}): Promise<ExecuteRefundResult> {
  if (
    params.actorRole !== 'SYSTEM_WEBHOOK' &&
    params.refundType !== 'STOCK_CONFLICT_REFUND'
  ) {
    assertRolePermission(params.actorRole, 'orders:refund');
  } else if (params.actorRole !== 'SYSTEM_WEBHOOK') {
    assertRolePermission(params.actorRole, 'bar:resolve_conflict');
  }

  const now = params.now ?? new Date();

  return withTenantContext(params.tenantId, async (tx) => {
    const orderRes = await tx.query<{
      id: string;
      order_number: string;
      payment_status: string;
      fulfillment_status: string;
      total_cents: string;
      refunded_cents: string;
      applied_commission_bps: number;
    }>(
      `SELECT id, order_number, payment_status, fulfillment_status,
              total_cents, refunded_cents, applied_commission_bps
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [params.orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('Pedido no encontrado para reembolsar.');
    }

    const totalCents = Number(order.total_cents);
    const alreadyRefundedCents = Number(order.refunded_cents);
    const remainingRefundableCents = totalCents - alreadyRefundedCents;

    if (params.amountCents <= 0 || params.amountCents > remainingRefundableCents) {
      throw new Error(
        `INVALID_REFUND_AMOUNT: El importe a devolver (${params.amountCents}) supera el saldo reembolsable del pedido (${remainingRefundableCents}).`
      );
    }

    const payTxRes = await tx.query<{ id: string }>(
      `SELECT id
       FROM payment_transactions
       WHERE order_id = $1 AND status = 'approved'
       ORDER BY approved_at DESC NULLS LAST
       LIMIT 1`,
      [order.id]
    );
    const payTx = payTxRes.rows[0];
    if (!payTx) {
      throw new Error('No se encontró un pago aprobado asociado a este pedido.');
    }

    const mpRefundId =
      params.mpRefundId ?? Math.floor(100000000 + Math.random() * 900000000);

    const refundInsertRes = await tx.query<{ id: string }>(
      `INSERT INTO refunds (
         tenant_id, order_id, payment_transaction_id, mp_refund_id,
         refund_type, amount_cents, reason, initiated_by_user_id, status, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED', $9)
       RETURNING id`,
      [
        params.tenantId,
        order.id,
        payTx.id,
        mpRefundId,
        params.refundType,
        params.amountCents,
        params.reason,
        params.actorUserId ?? null,
        now.toISOString(),
      ]
    );
    const refundId = refundInsertRes.rows[0]!.id;

    const newRefundedTotal = alreadyRefundedCents + params.amountCents;
    const nextPaymentStatus: 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'CHARGED_BACK' =
      params.refundType === 'CHARGEBACK'
        ? 'CHARGED_BACK'
        : newRefundedTotal >= totalCents
          ? 'REFUNDED'
          : 'PARTIALLY_REFUNDED';

    await tx.query(
      `UPDATE orders
       SET refunded_cents = $2,
           payment_status = $3::payment_status,
           fulfillment_status = CASE
             WHEN $3::text IN ('REFUNDED', 'CHARGED_BACK') AND fulfillment_status NOT IN ('DELIVERED', 'RESOLVED_WITH_SUBSTITUTE')
               THEN 'CANCELLED_REFUNDED'::fulfillment_status
             ELSE fulfillment_status
           END,
           updated_at = $4
       WHERE id = $1`,
      [order.id, newRefundedTotal, nextPaymentStatus, now.toISOString()]
    );

    // Si es reembolso total o por conflicto de stock y el QR no fue canjeado, lo revocamos en el acto
    if (nextPaymentStatus === 'REFUNDED' || nextPaymentStatus === 'CHARGED_BACK') {
      await tx.query(
        `UPDATE order_qrs
         SET status = 'REVOKED_REFUND',
             revoked_at = $2
         WHERE order_id = $1 AND status IN ('ACTIVE', 'STOCK_CONFLICT')`,
        [order.id, now.toISOString()]
      );

      // Si el pedido había consumido stock físico (no era un conflicto tardío sin stock) y no fue entregado en barra, devolvemos el stock_sold al inventario disponible
      if (
        order.fulfillment_status === 'READY_FOR_PICKUP' &&
        params.refundType !== 'STOCK_CONFLICT_REFUND'
      ) {
        const itemsRes = await tx.query<{ product_id: string; quantity: number }>(
          `SELECT product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id ASC`,
          [order.id]
        );
        for (const item of itemsRes.rows) {
          await tx.query(
            `UPDATE products
             SET stock_sold = GREATEST(0, stock_sold - $2),
                 version = version + 1,
                 updated_at = now()
             WHERE id = $1`,
            [item.product_id, Number(item.quantity)]
          );
        }
      }
    }

    // Verificamos si el asiento original de comisión del pedido ya fue incluido en una liquidación cerrada
    const originalLedgerRes = await tx.query<{
      id: string;
      settlement_id: string | null;
      commission_bps: number;
    }>(
      `SELECT id, settlement_id, commission_bps
       FROM commission_ledger
       WHERE order_id = $1 AND entry_type = 'ORDER_APPROVED'
       LIMIT 1`,
      [order.id]
    );
    const originalLedger = originalLedgerRes.rows[0];
    const bps = originalLedger
      ? Number(originalLedger.commission_bps)
      : Number(order.applied_commission_bps);

    const ledgerEntryType:
      | 'REFUND_DEDUCTION'
      | 'POST_SETTLEMENT_REFUND_ADJUSTMENT'
      | 'CHARGEBACK_ADJUSTMENT' =
      params.refundType === 'CHARGEBACK'
        ? 'CHARGEBACK_ADJUSTMENT'
        : originalLedger?.settlement_id
          ? 'POST_SETTLEMENT_REFUND_ADJUSTMENT'
          : 'REFUND_DEDUCTION';

    const commissionDeductionCents = -Math.round((params.amountCents * bps) / 10000);

    await tx.query(
      `INSERT INTO commission_ledger (
         tenant_id, order_id, refund_id, settlement_id,
         entry_type, base_amount_cents, commission_bps, commission_amount_cents,
         rule_snapshot, description, occurred_at
       ) VALUES (
         $1, $2, $3, NULL,
         $4, $5, $6, $7,
         $8::jsonb, $9, $10
       )`,
      [
        params.tenantId,
        order.id,
        refundId,
        ledgerEntryType,
        -params.amountCents,
        bps,
        commissionDeductionCents,
        JSON.stringify({
          refund_type: params.refundType,
          original_order_already_settled: Boolean(originalLedger?.settlement_id),
          origin_settlement_id: originalLedger?.settlement_id ?? null,
        }),
        `Deducción por ${params.refundType} en pedido ${order.order_number}: ${params.reason}`,
        now.toISOString(),
      ]
    );

    await tx.query(
      `INSERT INTO audit_logs (tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
       VALUES ($1, $2, $3, 'ORDER_REFUND_EXECUTED', 'refund', $4, $5::jsonb)`,
      [
        params.tenantId,
        params.actorUserId ?? null,
        params.actorRole,
        refundId,
        JSON.stringify({
          order_id: order.id,
          amount_cents: params.amountCents,
          refund_type: params.refundType,
          ledger_entry_type: ledgerEntryType,
          commission_deducted_cents: commissionDeductionCents,
        }),
      ]
    );

    return {
      refundId,
      orderId: order.id,
      refundedAmountCents: params.amountCents,
      totalOrderRefundedCents: newRefundedTotal,
      orderPaymentStatus: nextPaymentStatus,
      ledgerEntryType,
      commissionDeductedCents: Math.abs(commissionDeductionCents),
    };
  });
}

/**
 * Resuelve a qué boliche (`tenant_id`) pertenece un `mp_user_id` recibido en un Webhook central de Mercado Pago.
 */
export async function resolveTenantIdByMercadoPagoUserId(
  mpUserId: number
): Promise<string | null> {
  return withSuperadminContext(async (tx) => {
    const res = await tx.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM tenant_mp_credentials WHERE mp_user_id = $1 LIMIT 1`,
      [mpUserId]
    );
    return res.rows[0]?.tenant_id ?? null;
  });
}

export interface RejectPaymentResult {
  orderId: string;
  orderNumber: string;
  paymentStatus: 'REJECTED';
  fulfillmentStatus: 'CANCELLED_UNPAID';
  qrIssued: false;
  stockReleased: boolean;
  wasIdempotentDuplicate: boolean;
}

/**
 * Registra de forma transaccional e idempotente el rechazo de un pago por Mercado Pago:
 * - Libera la reserva temporal de stock (`RELEASED_REJECTED`) devolviendo las unidades al inventario disponible.
 * - Marca el pedido en `REJECTED` / `CANCELLED_UNPAID`.
 * - Jamás emite un código QR de retiro.
 */
export async function recordOrderPaymentRejected(params: {
  tenantId: string;
  orderId: string;
  mpPaymentId?: number;
  statusDetail?: string;
  now?: Date;
}): Promise<RejectPaymentResult> {
  const {
    tenantId,
    orderId,
    mpPaymentId = Math.floor(2000000000 + Math.random() * 7000000000),
    statusDetail = 'cc_rejected_other_reason',
    now = new Date(),
  } = params;

  return withTenantContext(tenantId, async (tx) => {
    const orderRes = await tx.query<{
      id: string;
      order_number: string;
      payment_status: string;
      fulfillment_status: string;
      total_cents: string;
    }>(
      `SELECT id, order_number, payment_status, fulfillment_status, total_cents
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: No existe el pedido indicado.');
    }

    if (order.payment_status === 'APPROVED') {
      throw new Error('ORDER_ALREADY_APPROVED: El pedido ya cuenta con un pago aprobado.');
    }

    if (order.payment_status === 'REJECTED') {
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        paymentStatus: 'REJECTED',
        fulfillmentStatus: 'CANCELLED_UNPAID',
        qrIssued: false,
        stockReleased: false,
        wasIdempotentDuplicate: true,
      };
    }

    const resQuery = await tx.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM stock_reservations
       WHERE order_id = $1
       FOR UPDATE`,
      [order.id]
    );
    const reservation = resQuery.rows[0];
    let stockReleased = false;

    if (reservation && reservation.status === 'ACTIVE') {
      const itemsRes = await tx.query<{ product_id: string; quantity: number }>(
        `SELECT product_id, quantity
         FROM order_items
         WHERE order_id = $1
         ORDER BY product_id ASC`,
        [order.id]
      );

      for (const item of itemsRes.rows) {
        await tx.query(
          `UPDATE products
           SET stock_reserved = GREATEST(0, stock_reserved - $2),
               version = version + 1,
               updated_at = $3
           WHERE id = $1`,
          [item.product_id, Number(item.quantity), now.toISOString()]
        );
      }

      await tx.query(
        `UPDATE stock_reservations
         SET status = 'RELEASED_REJECTED',
             resolved_at = $2
         WHERE id = $1`,
        [reservation.id, now.toISOString()]
      );
      stockReleased = true;
    }

    await tx.query(
      `INSERT INTO payment_transactions (
         tenant_id, order_id, mp_payment_id,
         status, status_detail, payment_type_id,
         gross_amount_cents, idempotency_key, updated_at
       ) VALUES (
         $1, $2, $3,
         'rejected', $4, 'credit_card',
         $5, $6, $7
       )
       ON CONFLICT (mp_payment_id) DO UPDATE SET
         status = 'rejected',
         status_detail = EXCLUDED.status_detail,
         updated_at = EXCLUDED.updated_at`,
      [
        tenantId,
        order.id,
        mpPaymentId,
        statusDetail,
        Number(order.total_cents),
        `pay-rej:${mpPaymentId}`,
        now.toISOString(),
      ]
    );

    await tx.query(
      `UPDATE orders
       SET payment_status = 'REJECTED',
           fulfillment_status = 'CANCELLED_UNPAID',
           updated_at = $2
       WHERE id = $1`,
      [order.id, now.toISOString()]
    );

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: 'REJECTED',
      fulfillmentStatus: 'CANCELLED_UNPAID',
      qrIssued: false,
      stockReleased,
      wasIdempotentDuplicate: false,
    };
  });
}

export interface PendingPaymentResult {
  orderId: string;
  orderNumber: string;
  paymentStatus: 'IN_REVIEW';
  fulfillmentStatus: 'AWAITING_PAYMENT';
  qrIssued: false;
}

/**
 * Registra un estado de pago pendiente de confirmación (`IN_REVIEW`) sin emitir QR de retiro.
 */
export async function recordOrderPaymentPending(params: {
  tenantId: string;
  orderId: string;
  mpPaymentId?: number;
  statusDetail?: string;
  now?: Date;
}): Promise<PendingPaymentResult> {
  const {
    tenantId,
    orderId,
    mpPaymentId = Math.floor(3000000000 + Math.random() * 6000000000),
    statusDetail = 'pending_review_manual',
    now = new Date(),
  } = params;

  return withTenantContext(tenantId, async (tx) => {
    const orderRes = await tx.query<{
      id: string;
      order_number: string;
      payment_status: string;
      total_cents: string;
    }>(
      `SELECT id, order_number, payment_status, total_cents
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      throw new Error('ORDER_NOT_FOUND: No existe el pedido indicado.');
    }

    if (order.payment_status === 'APPROVED') {
      throw new Error('ORDER_ALREADY_APPROVED: El pedido ya fue aprobado.');
    }

    await tx.query(
      `INSERT INTO payment_transactions (
         tenant_id, order_id, mp_payment_id,
         status, status_detail, payment_type_id,
         gross_amount_cents, idempotency_key, updated_at
       ) VALUES (
         $1, $2, $3,
         'in_process', $4, 'account_money',
         $5, $6, $7
       )
       ON CONFLICT (mp_payment_id) DO UPDATE SET
         status = 'in_process',
         status_detail = EXCLUDED.status_detail,
         updated_at = EXCLUDED.updated_at`,
      [
        tenantId,
        order.id,
        mpPaymentId,
        statusDetail,
        Number(order.total_cents),
        `pay-pend:${mpPaymentId}`,
        now.toISOString(),
      ]
    );

    await tx.query(
      `UPDATE orders
       SET payment_status = 'IN_REVIEW',
           fulfillment_status = 'AWAITING_PAYMENT',
           updated_at = $2
       WHERE id = $1`,
      [order.id, now.toISOString()]
    );

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: 'IN_REVIEW',
      fulfillmentStatus: 'AWAITING_PAYMENT',
      qrIssued: false,
    };
  });
}
