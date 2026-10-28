import { withSuperadminContext, withTenantContext } from '@/db';

export interface SettlementSummary {
  id: string;
  tenantId: string;
  settlementCode: string;
  periodStart: string;
  periodEnd: string;
  grossSalesCents: number;
  refundsAndAdjustmentsCents: number;
  commissionableBaseCents: number;
  commissionDueCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  status:
    | 'OPEN_DRAFT'
    | 'ISSUED_PENDING'
    | 'PARTIALLY_PAID'
    | 'PAID'
    | 'OVERDUE'
    | 'DISPUTED'
    | 'VOIDED';
  dueDate: string;
  itemsCount: number;
}

/**
 * Configura un nuevo porcentaje contractual de comisión para un boliche desde Superadmin.
 * Cierra la vigencia de la regla anterior y audita el cambio en `audit_logs`.
 */
export async function configureTenantCommissionRule(params: {
  tenantId: string;
  commissionBps: number;
  deductRefunds?: boolean;
  deductChargebacks?: boolean;
  effectiveFrom?: Date;
  notes?: string;
  superadminUserId?: string;
}): Promise<{ ruleId: string; commissionBps: number }> {
  if (
    !Number.isInteger(params.commissionBps) ||
    params.commissionBps < 0 ||
    params.commissionBps > 5000
  ) {
    throw new Error(
      'INVALID_COMMISSION_BPS: El porcentaje de comisión debe expresarse en basis points entre 0 y 5000 (0% a 50%).'
    );
  }

  const effectiveFromIso = (params.effectiveFrom ?? new Date()).toISOString();

  return withSuperadminContext(async (tx) => {
    await tx.query(
      `UPDATE tenant_commission_rules
       SET effective_to = $2
       WHERE tenant_id = $1 AND effective_to IS NULL`,
      [params.tenantId, effectiveFromIso]
    );

    const insertRes = await tx.query<{ id: string }>(
      `INSERT INTO tenant_commission_rules (
         tenant_id, commission_bps, deduct_refunds, deduct_chargebacks,
         effective_from, notes, created_by_superadmin_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        params.tenantId,
        params.commissionBps,
        params.deductRefunds ?? true,
        params.deductChargebacks ?? true,
        effectiveFromIso,
        params.notes ?? null,
        params.superadminUserId ?? null,
      ]
    );

    const ruleId = insertRes.rows[0]!.id;

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1, $2, 'SUPERADMIN', 'COMMISSION_RULE_CONFIGURED', 'tenant_commission_rule', $3, $4::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        ruleId,
        JSON.stringify({
          commission_bps: params.commissionBps,
          effective_from: effectiveFromIso,
        }),
      ]
    );

    return { ruleId, commissionBps: params.commissionBps };
  });
}

/**
 * Configura el plan de abono mensual de un boliche desde Superadmin.
 */
export async function configureTenantMonthlyPlan(params: {
  tenantId: string;
  planName: string;
  monthlyFeeCents: number;
  billingDayOfMonth?: number;
  superadminUserId?: string;
}): Promise<{ planId: string }> {
  if (params.monthlyFeeCents < 0) {
    throw new Error('El importe del abono mensual no puede ser negativo.');
  }

  return withSuperadminContext(async (tx) => {
    await tx.query(
      `UPDATE tenant_plans
       SET effective_to = now()
       WHERE tenant_id = $1 AND effective_to IS NULL`,
      [params.tenantId]
    );

    const res = await tx.query<{ id: string }>(
      `INSERT INTO tenant_plans (
         tenant_id, plan_name, monthly_fee_cents, billing_day_of_month, created_by_superadmin_id
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        params.tenantId,
        params.planName,
        params.monthlyFeeCents,
        params.billingDayOfMonth ?? 5,
        params.superadminUserId ?? null,
      ]
    );

    return { planId: res.rows[0]!.id };
  });
}

/**
 * Genera la Liquidación Semanal de un boliche recopilando todos los movimientos pendientes
 * del `commission_ledger` (pedidos aprobados menos devoluciones y ajustes post-liquidación).
 */
export async function generateWeeklySettlementForTenant(params: {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: string; // YYYY-MM-DD
  settlementCode: string;
  superadminUserId?: string;
}): Promise<SettlementSummary> {
  return withSuperadminContext(async (tx) => {
    // Bloqueamos los movimientos aún no liquidados del boliche dentro de la ventana
    const ledgerRes = await tx.query<{
      id: string;
      entry_type: string;
      base_amount_cents: string;
      commission_bps: number;
      commission_amount_cents: string;
    }>(
      `SELECT id, entry_type, base_amount_cents, commission_bps, commission_amount_cents
       FROM commission_ledger
       WHERE tenant_id = $1
         AND settlement_id IS NULL
         AND occurred_at >= $2
         AND occurred_at <= $3
       ORDER BY occurred_at ASC
       FOR UPDATE`,
      [
        params.tenantId,
        params.periodStart.toISOString(),
        params.periodEnd.toISOString(),
      ]
    );

    let grossSalesCents = 0;
    let refundsAndAdjustmentsCents = 0;
    let rawCommissionDueCents = 0;

    for (const entry of ledgerRes.rows) {
      const base = Number(entry.base_amount_cents);
      const comm = Number(entry.commission_amount_cents);
      if (base >= 0) {
        grossSalesCents += base;
      } else {
        refundsAndAdjustmentsCents += Math.abs(base);
      }
      rawCommissionDueCents += comm;
    }

    const commissionableBaseCents = grossSalesCents - refundsAndAdjustmentsCents;
    const commissionDueCents = Math.max(0, rawCommissionDueCents);
    const initialStatus = commissionDueCents === 0 ? 'PAID' : 'ISSUED_PENDING';

    const insertSettlementRes = await tx.query<{ id: string }>(
      `INSERT INTO settlements (
         tenant_id, settlement_code, period_start, period_end,
         gross_sales_cents, refunds_and_adjustments_cents,
         commissionable_base_cents, commission_due_cents,
         amount_paid_cents, balance_due_cents,
         status, due_date
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6,
         $7, $8,
         0, $8,
         $9, $10
       ) RETURNING id`,
      [
        params.tenantId,
        params.settlementCode,
        params.periodStart.toISOString(),
        params.periodEnd.toISOString(),
        grossSalesCents,
        refundsAndAdjustmentsCents,
        commissionableBaseCents,
        commissionDueCents,
        initialStatus,
        params.dueDate,
      ]
    );

    const settlementId = insertSettlementRes.rows[0]!.id;

    for (const entry of ledgerRes.rows) {
      await tx.query(
        `INSERT INTO settlement_items (
           tenant_id, settlement_id, ledger_entry_id,
           base_amount_cents, commission_bps, commission_amount_cents
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          params.tenantId,
          settlementId,
          entry.id,
          Number(entry.base_amount_cents),
          Number(entry.commission_bps),
          Number(entry.commission_amount_cents),
        ]
      );

      await tx.query(
        `UPDATE commission_ledger
         SET settlement_id = $2
         WHERE id = $1`,
        [entry.id, settlementId]
      );
    }

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
       ) VALUES ($1, $2, 'SUPERADMIN', 'WEEKLY_SETTLEMENT_GENERATED', 'settlement', $3, $4::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        settlementId,
        JSON.stringify({
          settlement_code: params.settlementCode,
          gross_sales_cents: grossSalesCents,
          refunds_and_adjustments_cents: refundsAndAdjustmentsCents,
          commissionable_base_cents: commissionableBaseCents,
          commission_due_cents: commissionDueCents,
          items_count: ledgerRes.rows.length,
        }),
      ]
    );

    return {
      id: settlementId,
      tenantId: params.tenantId,
      settlementCode: params.settlementCode,
      periodStart: params.periodStart.toISOString(),
      periodEnd: params.periodEnd.toISOString(),
      grossSalesCents,
      refundsAndAdjustmentsCents,
      commissionableBaseCents,
      commissionDueCents,
      amountPaidCents: 0,
      balanceDueCents: commissionDueCents,
      status: initialStatus,
      dueDate: params.dueDate,
      itemsCount: ledgerRes.rows.length,
    };
  });
}

/**
 * Registra el pago manual de una liquidación semanal por parte del boliche a BarraOnline.
 * - Impide duplicar comprobantes mediante restricción UNIQUE.
 * - Permite pagos parciales (`PARTIALLY_PAID`) o cancelación total (`PAID`).
 * - Jamás permite marcar una liquidación como pagada sin registrar el pago recibido.
 */
export async function recordManualSettlementPayment(params: {
  tenantId: string;
  settlementId: string;
  amountCents: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHECK' | 'OTHER';
  externalReferenceNumber: string;
  receiptFileUrl?: string;
  paidAt?: Date;
  superadminUserId?: string;
  notes?: string;
}): Promise<{
  paymentId: string;
  settlementStatus: 'PARTIALLY_PAID' | 'PAID';
  amountPaidCents: number;
  balanceDueCents: number;
}> {
  if (params.amountCents <= 0) {
    throw new Error('El importe del pago debe ser mayor a cero.');
  }
  if (!params.externalReferenceNumber || params.externalReferenceNumber.trim().length < 3) {
    throw new Error('Se requiere el número de comprobante o referencia de transferencia.');
  }

  return withSuperadminContext(async (tx) => {
    const sRes = await tx.query<{
      id: string;
      tenant_id: string;
      commission_due_cents: string;
      amount_paid_cents: string;
      balance_due_cents: string;
      status: string;
    }>(
      `SELECT id, tenant_id, commission_due_cents, amount_paid_cents, balance_due_cents, status
       FROM settlements
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [params.settlementId, params.tenantId]
    );

    const settlement = sRes.rows[0];
    if (!settlement) {
      throw new Error('Liquidación no encontrada para este boliche.');
    }

    const currentBalanceCents = Number(settlement.balance_due_cents);
    if (settlement.status === 'PAID' || currentBalanceCents === 0) {
      throw new Error('SETTLEMENT_ALREADY_PAID: Esta liquidación ya se encuentra pagada en su totalidad.');
    }
    if (params.amountCents > currentBalanceCents) {
      throw new Error(
        `OVERPAYMENT_NOT_ALLOWED: El pago registrado (${params.amountCents}) supera el saldo pendiente de la liquidación (${currentBalanceCents}).`
      );
    }

    const payInsertRes = await tx.query<{ id: string }>(
      `INSERT INTO settlement_payments (
         tenant_id, settlement_id, amount_cents, payment_method,
         external_reference_number, receipt_file_url, paid_at,
         recorded_by_superadmin_id, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        params.tenantId,
        params.settlementId,
        params.amountCents,
        params.paymentMethod,
        params.externalReferenceNumber.trim(),
        params.receiptFileUrl ?? null,
        (params.paidAt ?? new Date()).toISOString(),
        params.superadminUserId ?? null,
        params.notes ?? null,
      ]
    );
    const paymentId = payInsertRes.rows[0]!.id;

    const newAmountPaidCents = Number(settlement.amount_paid_cents) + params.amountCents;
    const newBalanceDueCents = Number(settlement.commission_due_cents) - newAmountPaidCents;
    const nextStatus: 'PARTIALLY_PAID' | 'PAID' =
      newBalanceDueCents === 0 ? 'PAID' : 'PARTIALLY_PAID';

    await tx.query(
      `UPDATE settlements
       SET amount_paid_cents = $2,
           balance_due_cents = $3,
           status = $4::settlement_status,
           closed_at = CASE WHEN $4::text = 'PAID' THEN now() ELSE closed_at END
       WHERE id = $1`,
      [params.settlementId, newAmountPaidCents, newBalanceDueCents, nextStatus]
    );

    await tx.query(
      `INSERT INTO audit_logs (
         tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
       ) VALUES ($1, $2, 'SUPERADMIN', 'SETTLEMENT_PAYMENT_RECORDED', 'settlement', $3, $4::jsonb, $5::jsonb)`,
      [
        params.tenantId,
        params.superadminUserId ?? null,
        params.settlementId,
        JSON.stringify({
          amount_paid_cents: Number(settlement.amount_paid_cents),
          balance_due_cents: currentBalanceCents,
          status: settlement.status,
        }),
        JSON.stringify({
          payment_id: paymentId,
          payment_reference: params.externalReferenceNumber.trim(),
          amount_paid_cents: newAmountPaidCents,
          balance_due_cents: newBalanceDueCents,
          status: nextStatus,
        }),
      ]
    );

    return {
      paymentId,
      settlementStatus: nextStatus,
      amountPaidCents: newAmountPaidCents,
      balanceDueCents: newBalanceDueCents,
    };
  });
}

export async function listSettlementsForTenant(
  tenantId: string
): Promise<SettlementSummary[]> {
  return withTenantContext(tenantId, async (tx) => {
    const res = await tx.query<{
      id: string;
      tenant_id: string;
      settlement_code: string;
      period_start: string;
      period_end: string;
      gross_sales_cents: string;
      refunds_and_adjustments_cents: string;
      commissionable_base_cents: string;
      commission_due_cents: string;
      amount_paid_cents: string;
      balance_due_cents: string;
      status: SettlementSummary['status'];
      due_date: string;
      items_count: string;
    }>(
      `SELECT s.*,
              (SELECT COUNT(*) FROM settlement_items si WHERE si.settlement_id = s.id) AS items_count
       FROM settlements s
       ORDER BY s.period_start DESC`
    );

    return res.rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      settlementCode: r.settlement_code,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      grossSalesCents: Number(r.gross_sales_cents),
      refundsAndAdjustmentsCents: Number(r.refunds_and_adjustments_cents),
      commissionableBaseCents: Number(r.commissionable_base_cents),
      commissionDueCents: Number(r.commission_due_cents),
      amountPaidCents: Number(r.amount_paid_cents),
      balanceDueCents: Number(r.balance_due_cents),
      status: r.status,
      dueDate: r.due_date,
      itemsCount: Number(r.items_count),
    }));
  });
}
