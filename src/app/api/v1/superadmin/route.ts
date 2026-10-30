import { NextResponse, type NextRequest } from 'next/server';
import { withSuperadminContext } from '@/db';
import { ensureDemoDataSeeded, SEED_IDS } from '@/db/seed';
import {
  configureTenantCommissionRule,
  configureTenantMonthlyPlan,
  generateWeeklySettlementForTenant,
  recordManualSettlementPayment,
} from '@/modules/billing-settlements/settlement-service';
import { updateTenantStatusBySuperadmin } from '@/modules/tenancy/tenant-service';
import {
  ADMIN_SESSION_COOKIE,
  verifySuperadminSessionServerSide,
} from '@/modules/identity/admin-auth-service';

export async function GET(request: NextRequest) {
  await ensureDemoDataSeeded();

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const admin = await verifySuperadminSessionServerSide(adminToken);
  if (!admin || !admin.isSuperadmin) {
    return NextResponse.json(
      { error: 'No autorizado. Acceso exclusivo para superadministradores.' },
      { status: 401 }
    );
  }

  const data = await withSuperadminContext(async (tx) => {
    const tenantsRes = await tx.query<{
      id: string;
      slug: string;
      legal_name: string;
      fantasy_name: string;
      cuit: string;
      city: string;
      status: string;
      mp_user_id: string | null;
      mp_connection_status: string | null;
      commission_bps: number | null;
      plan_name: string | null;
      monthly_fee_cents: string | null;
      unsettled_commission_cents: string | null;
    }>(
      `SELECT t.id, t.slug, t.legal_name, t.fantasy_name, t.cuit, t.city, t.status,
              mc.mp_user_id, mc.connection_status AS mp_connection_status,
              (SELECT cr.commission_bps FROM tenant_commission_rules cr WHERE cr.tenant_id = t.id AND cr.effective_to IS NULL ORDER BY cr.effective_from DESC LIMIT 1) AS commission_bps,
              (SELECT tp.plan_name FROM tenant_plans tp WHERE tp.tenant_id = t.id AND tp.effective_to IS NULL ORDER BY tp.effective_from DESC LIMIT 1) AS plan_name,
              (SELECT tp.monthly_fee_cents FROM tenant_plans tp WHERE tp.tenant_id = t.id AND tp.effective_to IS NULL ORDER BY tp.effective_from DESC LIMIT 1) AS monthly_fee_cents,
              (SELECT COALESCE(SUM(cl.commission_amount_cents), 0) FROM commission_ledger cl WHERE cl.tenant_id = t.id AND cl.settlement_id IS NULL) AS unsettled_commission_cents
       FROM tenants t
       LEFT JOIN tenant_mp_credentials mc ON mc.tenant_id = t.id
       ORDER BY t.fantasy_name ASC`
    );

    const settlementsRes = await tx.query<{
      id: string;
      tenant_id: string;
      fantasy_name: string;
      slug: string;
      settlement_code: string;
      period_start: string;
      period_end: string;
      gross_sales_cents: string;
      refunds_and_adjustments_cents: string;
      commissionable_base_cents: string;
      commission_due_cents: string;
      amount_paid_cents: string;
      balance_due_cents: string;
      status: string;
      due_date: string;
    }>(
      `SELECT s.*, t.fantasy_name, t.slug
       FROM settlements s
       INNER JOIN tenants t ON t.id = s.tenant_id
       ORDER BY s.issued_at DESC`
    );

    const paymentsRes = await tx.query<{
      id: string;
      settlement_id: string;
      fantasy_name: string;
      amount_cents: string;
      payment_method: string;
      external_reference_number: string;
      paid_at: string;
      notes: string | null;
    }>(
      `SELECT sp.id, sp.settlement_id, t.fantasy_name, sp.amount_cents,
              sp.payment_method, sp.external_reference_number, sp.paid_at, sp.notes
       FROM settlement_payments sp
       INNER JOIN tenants t ON t.id = sp.tenant_id
       ORDER BY sp.created_at DESC
       LIMIT 20`
    );

    const subscriptionsRes = await tx.query<{
      id: string;
      tenant_id: string;
      fantasy_name: string;
      billing_period: string;
      amount_cents: string;
      paid_amount_cents: string;
      status: string;
      due_date: string;
      payment_reference: string | null;
    }>(
      `SELECT si.id, si.tenant_id, t.fantasy_name, si.billing_period,
              si.amount_cents, si.paid_amount_cents, si.status, si.due_date, si.payment_reference
       FROM subscription_invoices si
       INNER JOIN tenants t ON t.id = si.tenant_id
       ORDER BY si.billing_period DESC, t.fantasy_name ASC`
    );

    const auditRes = await tx.query<{
      id: string;
      actor_role: string;
      action: string;
      entity_type: string;
      entity_id: string;
      after_state: Record<string, unknown> | null;
      created_at: string;
    }>(
      `SELECT id, actor_role, action, entity_type, entity_id, after_state, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 20`
    );

    return {
      tenants: tenantsRes.rows.map((t) => ({
        id: t.id,
        slug: t.slug,
        legalName: t.legal_name,
        fantasyName: t.fantasy_name,
        cuit: t.cuit,
        city: t.city,
        status: t.status,
        mpUserId: t.mp_user_id ? Number(t.mp_user_id) : null,
        mpConnectionStatus: t.mp_connection_status ?? 'NOT_CONNECTED',
        commissionBps: Number(t.commission_bps ?? 500),
        planName: t.plan_name ?? 'Sin Plan',
        monthlyFeeCents: Number(t.monthly_fee_cents ?? 0),
        unsettledCommissionCents: Number(t.unsettled_commission_cents ?? 0),
      })),
      settlements: settlementsRes.rows.map((s) => ({
        id: s.id,
        tenantId: s.tenant_id,
        fantasyName: s.fantasy_name,
        slug: s.slug,
        settlementCode: s.settlement_code,
        periodStart: s.period_start,
        periodEnd: s.period_end,
        grossSalesCents: Number(s.gross_sales_cents),
        refundsAndAdjustmentsCents: Number(s.refunds_and_adjustments_cents),
        commissionableBaseCents: Number(s.commissionable_base_cents),
        commissionDueCents: Number(s.commission_due_cents),
        amountPaidCents: Number(s.amount_paid_cents),
        balanceDueCents: Number(s.balance_due_cents),
        status: s.status,
        dueDate: s.due_date,
      })),
      settlementPayments: paymentsRes.rows.map((p) => ({
        id: p.id,
        settlementId: p.settlement_id,
        fantasyName: p.fantasy_name,
        amountCents: Number(p.amount_cents),
        paymentMethod: p.payment_method,
        externalReferenceNumber: p.external_reference_number,
        paidAt: p.paid_at,
        notes: p.notes,
      })),
      subscriptionInvoices: subscriptionsRes.rows.map((si) => ({
        id: si.id,
        tenantId: si.tenant_id,
        fantasyName: si.fantasy_name,
        billingPeriod: si.billing_period,
        amountCents: Number(si.amount_cents),
        paidAmountCents: Number(si.paid_amount_cents),
        status: si.status,
        dueDate: si.due_date,
        paymentReference: si.payment_reference,
      })),
      auditLogs: auditRes.rows,
    };
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  await ensureDemoDataSeeded();

  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const admin = await verifySuperadminSessionServerSide(adminToken);
  if (!admin || !admin.isSuperadmin) {
    return NextResponse.json(
      { error: 'No autorizado. Acceso exclusivo para superadministradores.' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      action:
        | 'UPDATE_COMMISSION_RULE'
        | 'UPDATE_MONTHLY_PLAN'
        | 'GENERATE_SETTLEMENT'
        | 'RECORD_SETTLEMENT_PAYMENT'
        | 'UPDATE_TENANT_STATUS';
      tenantId: string;
      commissionBps?: number;
      planName?: string;
      monthlyFeeCents?: number;
      settlementId?: string;
      amountCents?: number;
      paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'OTHER';
      externalReferenceNumber?: string;
      notes?: string;
      newStatus?: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
    };

    if (
      body.action === 'UPDATE_COMMISSION_RULE' &&
      typeof body.commissionBps === 'number'
    ) {
      const rule = await configureTenantCommissionRule({
        tenantId: body.tenantId,
        commissionBps: body.commissionBps,
        notes: body.notes ?? 'Actualización desde panel de Superadministración',
        superadminUserId: SEED_IDS.SUPERADMIN_USER,
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (
      body.action === 'UPDATE_MONTHLY_PLAN' &&
      body.planName &&
      typeof body.monthlyFeeCents === 'number'
    ) {
      const plan = await configureTenantMonthlyPlan({
        tenantId: body.tenantId,
        planName: body.planName,
        monthlyFeeCents: body.monthlyFeeCents,
        superadminUserId: SEED_IDS.SUPERADMIN_USER,
      });
      return NextResponse.json({ ok: true, plan });
    }

    if (body.action === 'GENERATE_SETTLEMENT') {
      const code = `LIQ-${body.tenantId.slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-5)}`;
      const settlement = await generateWeeklySettlementForTenant({
        tenantId: body.tenantId,
        periodStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(Date.now() + 60 * 1000),
        dueDate: '2026-11-12',
        settlementCode: code,
        superadminUserId: SEED_IDS.SUPERADMIN_USER,
      });
      return NextResponse.json({ ok: true, settlement });
    }

    if (
      body.action === 'RECORD_SETTLEMENT_PAYMENT' &&
      body.settlementId &&
      typeof body.amountCents === 'number' &&
      body.externalReferenceNumber
    ) {
      const payment = await recordManualSettlementPayment({
        tenantId: body.tenantId,
        settlementId: body.settlementId,
        amountCents: body.amountCents,
        paymentMethod: body.paymentMethod ?? 'BANK_TRANSFER',
        externalReferenceNumber: body.externalReferenceNumber,
        notes: body.notes,
        superadminUserId: SEED_IDS.SUPERADMIN_USER,
      });
      return NextResponse.json({ ok: true, payment });
    }

    if (body.action === 'UPDATE_TENANT_STATUS' && body.newStatus) {
      const updated = await updateTenantStatusBySuperadmin({
        tenantId: body.tenantId,
        newStatus: body.newStatus,
        superadminUserId: SEED_IDS.SUPERADMIN_USER,
      });
      return NextResponse.json({ ok: true, updated });
    }

    return NextResponse.json(
      { error: 'INVALID_SUPERADMIN_ACTION' },
      { status: 400 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error en operación de Superadmin';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
