import { NextResponse, type NextRequest } from 'next/server';
import { withSuperadminContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import {
  confirmOrderPaymentAndIssueQr,
  recordOrderPaymentPending,
  recordOrderPaymentRejected,
  resolveTenantIdByMercadoPagoUserId,
} from '@/modules/payments/mercadopago-service';
import { verifyMercadoPagoWebhookSignature } from '@/modules/security/crypto-vault';

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  const dataIdParam =
    request.nextUrl.searchParams.get('data.id') ??
    request.nextUrl.searchParams.get('id');

  const body = (await request.json().catch(() => null)) as {
    id?: string | number;
    type?: string;
    action?: string;
    user_id?: number | string;
    data?: { id?: string | number };
    order_id?: string;
    gross_amount_cents?: number;
    payment_status?: 'approved' | 'rejected' | 'pending' | 'in_process';
  } | null;

  const resourceId = String(dataIdParam ?? body?.data?.id ?? '');
  const externalEventId = String(body?.id ?? xRequestId ?? resourceId);
  const topic = String(body?.type ?? 'payment');
  const action = String(body?.action ?? 'payment.updated');
  const mpUserId = body?.user_id ? Number(body.user_id) : null;

  const webhookSecret =
    process.env.MP_WEBHOOK_SECRET || 'mp_webhook_hmac_secret_placeholder';

  const verification = verifyMercadoPagoWebhookSignature({
    xSignatureHeader: xSignature,
    xRequestIdHeader: xRequestId,
    dataIdQueryParam: resourceId,
    webhookSecret,
  });

  if (!verification.valid) {
    await withSuperadminContext(async (tx) => {
      await tx.query(
        `INSERT INTO webhook_events (
           provider, external_event_id, topic, action, mp_user_id,
           resource_id, signature_valid, processing_status, payload, error_message
         ) VALUES ('MERCADOPAGO', $1, $2, $3, $4, $5, false, 'FAILED', $6::jsonb, $7)
         ON CONFLICT (provider, external_event_id, action, resource_id) DO NOTHING`,
        [
          externalEventId || 'unknown',
          topic,
          action,
          mpUserId,
          resourceId || 'unknown',
          JSON.stringify(body ?? {}),
          verification.reason ?? 'INVALID_SIGNATURE',
        ]
      );
    });

    return NextResponse.json(
      {
        error: 'INVALID_WEBHOOK_SIGNATURE',
        reason: verification.reason,
      },
      { status: 401 }
    );
  }

  const tenantId = mpUserId
    ? await resolveTenantIdByMercadoPagoUserId(mpUserId)
    : null;

  // Registro idempotente del evento
  const isDuplicate = await withSuperadminContext(async (tx) => {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO webhook_events (
         provider, external_event_id, topic, action, mp_user_id, tenant_id,
         resource_id, signature_valid, processing_status, payload
       ) VALUES ('MERCADOPAGO', $1, $2, $3, $4, $5, $6, true, 'RECEIVED', $7::jsonb)
       ON CONFLICT (provider, external_event_id, action, resource_id) DO NOTHING
       RETURNING id`,
      [
        externalEventId,
        topic,
        action,
        mpUserId,
        tenantId,
        resourceId,
        JSON.stringify(body ?? {}),
      ]
    );
    return res.rowCount === 0;
  });

  if (isDuplicate) {
    return NextResponse.json({ status: 'IGNORED_DUPLICATE' }, { status: 200 });
  }

  if (tenantId && topic === 'payment' && body?.order_id) {
    let result: unknown;
    if (body.payment_status === 'rejected') {
      result = await recordOrderPaymentRejected({
        tenantId,
        orderId: body.order_id,
        mpPaymentId: Number(resourceId),
      });
    } else if (
      body.payment_status === 'pending' ||
      body.payment_status === 'in_process'
    ) {
      result = await recordOrderPaymentPending({
        tenantId,
        orderId: body.order_id,
        mpPaymentId: Number(resourceId),
      });
    } else if (typeof body?.gross_amount_cents === 'number') {
      result = await confirmOrderPaymentAndIssueQr({
        tenantId,
        orderId: body.order_id,
        mpPaymentId: Number(resourceId),
        grossAmountCents: body.gross_amount_cents,
      });
    }

    if (result) {
      await withSuperadminContext(async (tx) => {
        await tx.query(
          `UPDATE webhook_events
           SET processing_status = 'PROCESSED', processed_at = now()
           WHERE provider = 'MERCADOPAGO' AND external_event_id = $1 AND action = $2 AND resource_id = $3`,
          [externalEventId, action, resourceId]
        );
      });

      return NextResponse.json({ status: 'PROCESSED', result }, { status: 200 });
    }
  }

  return NextResponse.json({ status: 'RECEIVED' }, { status: 200 });
}
