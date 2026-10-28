import { NextResponse, type NextRequest } from 'next/server';
import { withTenantContext } from '@/db';
import { ensureDemoDataSeeded } from '@/db/seed';
import { listSettlementsForTenant } from '@/modules/billing-settlements/settlement-service';
import {
  getPublicCatalogForTenant,
  updateProductStockOrPrice,
} from '@/modules/catalog/catalog-service';
import {
  buildMercadoPagoOAuthAuthorizationUrl,
  executeOrderRefundOrChargeback,
} from '@/modules/payments/mercadopago-service';
import { getTenantBySlug } from '@/modules/tenancy/tenant-service';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
  }

  const catalog = await getPublicCatalogForTenant(tenant.id);
  const settlements = await listSettlementsForTenant(tenant.id);
  const oauthPreview = buildMercadoPagoOAuthAuthorizationUrl({
    tenantId: tenant.id,
  });

  const ownerDetails = await withTenantContext(tenant.id, async (tx) => {
    const mpRes = await tx.query<{
      mp_user_id: string;
      mp_public_key: string;
      connection_status: string;
      token_expires_at: string;
      last_refreshed_at: string;
    }>(
      `SELECT mp_user_id, mp_public_key, connection_status, token_expires_at, last_refreshed_at
       FROM tenant_mp_credentials
       WHERE tenant_id = $1`,
      [tenant.id]
    );

    const ruleRes = await tx.query<{
      commission_bps: number;
      effective_from: string;
      notes: string | null;
    }>(
      `SELECT commission_bps, effective_from, notes
       FROM tenant_commission_rules
       WHERE effective_to IS NULL
       ORDER BY effective_from DESC
       LIMIT 1`
    );

    const planRes = await tx.query<{
      plan_name: string;
      monthly_fee_cents: string;
      billing_day_of_month: number;
    }>(
      `SELECT plan_name, monthly_fee_cents, billing_day_of_month
       FROM tenant_plans
       WHERE effective_to IS NULL
       ORDER BY effective_from DESC
       LIMIT 1`
    );

    const ordersRes = await tx.query<{
      id: string;
      order_number: string;
      customer_display_name: string | null;
      payment_status: string;
      fulfillment_status: string;
      total_cents: string;
      refunded_cents: string;
      applied_commission_bps: number;
      business_date: string;
      created_at: string;
      mp_fee_cents: string | null;
      net_received_by_tenant_cents: string | null;
    }>(
      `SELECT o.id, o.order_number, o.customer_display_name,
              o.payment_status, o.fulfillment_status,
              o.total_cents, o.refunded_cents, o.applied_commission_bps,
              o.business_date, o.created_at,
              pt.mp_fee_cents, pt.net_received_by_tenant_cents
       FROM orders o
       LEFT JOIN payment_transactions pt ON pt.tenant_id = o.tenant_id AND pt.order_id = o.id AND pt.status = 'approved'
       ORDER BY o.created_at DESC
       LIMIT 25`
    );

    const ledgerRes = await tx.query<{
      id: string;
      entry_type: string;
      base_amount_cents: string;
      commission_bps: number;
      commission_amount_cents: string;
      settlement_id: string | null;
      description: string;
      occurred_at: string;
    }>(
      `SELECT id, entry_type, base_amount_cents, commission_bps,
              commission_amount_cents, settlement_id, description, occurred_at
       FROM commission_ledger
       ORDER BY occurred_at DESC
       LIMIT 30`
    );

    return {
      mpConnection: mpRes.rows[0] ?? null,
      activeCommissionRule: ruleRes.rows[0] ?? null,
      activePlan: planRes.rows[0]
        ? {
            planName: planRes.rows[0].plan_name,
            monthlyFeeCents: Number(planRes.rows[0].monthly_fee_cents),
            billingDayOfMonth: Number(planRes.rows[0].billing_day_of_month),
          }
        : null,
      orders: ordersRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerDisplayName: o.customer_display_name ?? 'Invitado',
        paymentStatus: o.payment_status,
        fulfillmentStatus: o.fulfillment_status,
        totalCents: Number(o.total_cents),
        refundedCents: Number(o.refunded_cents),
        appliedCommissionBps: Number(o.applied_commission_bps),
        mpFeeCents: o.mp_fee_cents !== null ? Number(o.mp_fee_cents) : 0,
        netReceivedByTenantCents:
          o.net_received_by_tenant_cents !== null
            ? Number(o.net_received_by_tenant_cents)
            : Number(o.total_cents),
        businessDate: o.business_date,
        createdAt: o.created_at,
      })),
      commissionLedger: ledgerRes.rows.map((l) => ({
        id: l.id,
        entryType: l.entry_type,
        baseAmountCents: Number(l.base_amount_cents),
        commissionBps: Number(l.commission_bps),
        commissionAmountCents: Number(l.commission_amount_cents),
        isSettled: Boolean(l.settlement_id),
        description: l.description,
        occurredAt: l.occurred_at,
      })),
    };
  });

  return NextResponse.json({
    tenant,
    catalog,
    settlements,
    oauthAuthorizationUrl: oauthPreview.authorizationUrl,
    ...ownerDetails,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  await ensureDemoDataSeeded();
  const { slug } = await context.params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return NextResponse.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      action: 'UPDATE_PRODUCT' | 'REFUND_ORDER';
      productId?: string;
      priceCents?: number;
      promoPriceCents?: number | null;
      stockTotal?: number;
      orderId?: string;
      refundAmountCents?: number;
      refundReason?: string;
    };

    if (body.action === 'UPDATE_PRODUCT' && body.productId) {
      await updateProductStockOrPrice({
        tenantId: tenant.id,
        actorRole: 'OWNER',
        productId: body.productId,
        priceCents: body.priceCents,
        promoPriceCents: body.promoPriceCents,
        stockTotal: body.stockTotal,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'REFUND_ORDER' && body.orderId && body.refundAmountCents) {
      const refundResult = await executeOrderRefundOrChargeback({
        tenantId: tenant.id,
        actorRole: 'OWNER',
        orderId: body.orderId,
        amountCents: body.refundAmountCents,
        refundType: 'PARTIAL',
        reason: body.refundReason || 'Devolución operativa desde panel del dueño',
      });
      return NextResponse.json({ ok: true, refundResult });
    }

    return NextResponse.json({ error: 'INVALID_OWNER_ACTION' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error en panel del dueño';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
