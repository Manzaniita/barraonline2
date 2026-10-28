'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Percent,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import {
  formatArsFromCents,
  formatBpsAsPercentage,
  formatDateTimeAr,
} from '@/lib/format';

interface SuperadminTenant {
  id: string;
  slug: string;
  legalName: string;
  fantasyName: string;
  cuit: string;
  city: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  mpUserId: number | null;
  mpConnectionStatus: string;
  commissionBps: number;
  planName: string;
  monthlyFeeCents: number;
  unsettledCommissionCents: number;
}

interface SuperadminSettlement {
  id: string;
  tenantId: string;
  fantasyName: string;
  slug: string;
  settlementCode: string;
  periodStart: string;
  periodEnd: string;
  grossSalesCents: number;
  refundsAndAdjustmentsCents: number;
  commissionableBaseCents: number;
  commissionDueCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  status: string;
  dueDate: string;
}

interface SuperadminPayment {
  id: string;
  settlementId: string;
  fantasyName: string;
  amountCents: number;
  paymentMethod: string;
  externalReferenceNumber: string;
  paidAt: string;
  notes: string | null;
}

interface SubscriptionInvoiceRow {
  id: string;
  tenantId: string;
  fantasyName: string;
  billingPeriod: string;
  amountCents: number;
  paidAmountCents: number;
  status: string;
  dueDate: string;
  paymentReference: string | null;
}

interface AuditLogRow {
  id: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export default function SuperadminPage() {
  const [tenants, setTenants] = useState<SuperadminTenant[]>([]);
  const [settlements, setSettlements] = useState<SuperadminSettlement[]>([]);
  const [payments, setPayments] = useState<SuperadminPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInvoiceRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [newCommissionPct, setNewCommissionPct] = useState<string>('5.5');
  const [newMonthlyFeePesos, setNewMonthlyFeePesos] = useState<string>('380000');
  const [newPlanName, setNewPlanName] = useState<string>('Plan Temporada Costa');

  const [paymentRefInput, setPaymentRefInput] = useState<Record<string, string>>({});
  const [paymentAmountPesosInput, setPaymentAmountPesosInput] = useState<
    Record<string, string>
  >({});

  const [banner, setBanner] = useState<{
    type: 'OK' | 'ERR';
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadDashboard() {
    const res = await fetch('/api/v1/superadmin', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    setTenants(data.tenants || []);
    setSettlements(data.settlements || []);
    setPayments(data.settlementPayments || []);
    setSubscriptions(data.subscriptionInvoices || []);
    setAuditLogs(data.auditLogs || []);
    if (!selectedTenantId && data.tenants?.[0]?.id) {
      setSelectedTenantId(data.tenants[0].id);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleUpdateCommissionRule() {
    if (!selectedTenantId) return;
    const pct = Number.parseFloat(newCommissionPct.replace(',', '.'));
    if (Number.isNaN(pct) || pct < 0 || pct > 50) {
      setBanner({ type: 'ERR', text: 'Porcentaje inválido (debe ser entre 0% y 50%).' });
      return;
    }
    const bps = Math.round(pct * 100);
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_COMMISSION_RULE',
          tenantId: selectedTenantId,
          commissionBps: bps,
          notes: `Cambio comercial desde Superadmin a ${pct}% (${bps} bps)`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'ERR', text: data.error });
        return;
      }
      setBanner({
        type: 'OK',
        text: `Regla de comisión actualizada a ${formatBpsAsPercentage(bps)} y registrada en audit_logs.`,
      });
      await loadDashboard();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMonthlyPlan() {
    if (!selectedTenantId) return;
    const pesos = Number.parseFloat(newMonthlyFeePesos);
    if (Number.isNaN(pesos) || pesos < 0) return;
    const feeCents = Math.round(pesos * 100);
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_MONTHLY_PLAN',
          tenantId: selectedTenantId,
          planName: newPlanName,
          monthlyFeeCents: feeCents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'ERR', text: data.error });
        return;
      }
      setBanner({
        type: 'OK',
        text: `Abono mensual configurado en ${formatArsFromCents(feeCents)} (${newPlanName}).`,
      });
      await loadDashboard();
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateWeeklySettlement(tenantId: string) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'GENERATE_SETTLEMENT',
          tenantId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'ERR', text: data.error });
        return;
      }
      setBanner({
        type: 'OK',
        text: `Liquidación semanal ${data.settlement.settlementCode} emitida por ${formatArsFromCents(data.settlement.commissionDueCents)}.`,
      });
      await loadDashboard();
    } finally {
      setBusy(false);
    }
  }

  async function handleRecordManualPayment(settlement: SuperadminSettlement) {
    const refNumber = (
      paymentRefInput[settlement.id] ||
      `CBU-TRF-${Date.now().toString().slice(-6)}`
    ).trim();

    const customPesos = paymentAmountPesosInput[settlement.id];
    const amountCents = customPesos
      ? Math.round(Number.parseFloat(customPesos) * 100)
      : settlement.balanceDueCents;

    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECORD_SETTLEMENT_PAYMENT',
          tenantId: settlement.tenantId,
          settlementId: settlement.id,
          amountCents,
          paymentMethod: 'BANK_TRANSFER',
          externalReferenceNumber: refNumber,
          notes: 'Transferencia bancaria conciliada manualmente',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'ERR', text: data.error });
        return;
      }
      setBanner({
        type: 'OK',
        text: `Pago manual de ${formatArsFromCents(amountCents)} registrado con comprobante ${refNumber}. Estado liquidación: ${data.payment.settlementStatus}.`,
      });
      await loadDashboard();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTenantStatus(
    tenant: SuperadminTenant,
    newStatus: 'ACTIVE' | 'PAUSED_MORA'
  ) {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_TENANT_STATUS',
          tenantId: tenant.id,
          newStatus,
        }),
      });
      if (res.ok) {
        setBanner({
          type: 'OK',
          text: `Estado de ${tenant.fantasyName} actualizado a ${newStatus}.`,
        });
        await loadDashboard();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100">
      <header className="border-b border-white/10 bg-[#0D1018] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-[#00F0FF] px-2.5 py-0.5 text-[11px] font-black text-black uppercase">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  SUPERADMINISTRACIÓN CENTRAL
                </span>
                <h1 className="text-xl font-black text-white">BarraOnline.com.ar</h1>
              </div>
              <p className="text-xs text-slate-400">
                Gobierno de Boliches, Reglas de Comisión, Planes de Abono, Liquidaciones
                Semanales y Conciliación Manual
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar Datos
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {banner && (
          <div
            className={`rounded-2xl border p-4 text-xs font-bold ${
              banner.type === 'OK'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-200'
            }`}
          >
            {banner.text}
          </div>
        )}

        {/* 1. Directorio de Boliches y Estado Comercial */}
        <section className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
          <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#FF2E63]" />
            Establecimientos Conectados (Tenants) y Estado de Mercado Pago
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 pr-3">Boliche / Subdominio</th>
                  <th className="py-2.5 pr-3">CUIT</th>
                  <th className="py-2.5 pr-3">Estado</th>
                  <th className="py-2.5 pr-3">Conexión MP OAuth</th>
                  <th className="py-2.5 pr-3">Comisión Vigente</th>
                  <th className="py-2.5 pr-3">Abono Mensual</th>
                  <th className="py-2.5 pr-3">Comisión No Liquidada</th>
                  <th className="py-2.5">Acciones Superadmin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-white">{t.fantasyName}</div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {t.slug}.barraonline.com.ar
                      </div>
                    </td>
                    <td className="py-3 pr-3 font-mono text-slate-300">{t.cuit}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t.mpConnectionStatus} (#{t.mpUserId})
                      </span>
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-black text-[#00F0FF]">
                      {formatBpsAsPercentage(t.commissionBps)}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-bold text-white">
                      {formatArsFromCents(t.monthlyFeeCents)}
                      <span className="block text-[10px] text-slate-400">
                        {t.planName}
                      </span>
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-bold text-amber-300">
                      {formatArsFromCents(t.unsettledCommissionCents)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleGenerateWeeklySettlement(t.id)}
                          className="rounded-lg bg-[#00F0FF] px-2.5 py-1.5 text-[11px] font-black text-black uppercase"
                        >
                          Emitir Liquidación Semanal
                        </button>
                        {t.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void handleToggleTenantStatus(t, 'PAUSED_MORA')
                            }
                            className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-300"
                          >
                            Pausar por Mora
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleTenantStatus(t, 'ACTIVE')}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300"
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. Configurador Comercial Dinámico (Comisión % y Abono Mensual) */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
              <Percent className="h-4 w-4 text-[#00F0FF]" />
              Configurar Porcentaje de Comisión Variable por Boliche
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400">
                  Seleccionar Boliche:
                </label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-xs font-bold text-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fantasyName} (Actual: {formatBpsAsPercentage(t.commissionBps)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400">
                  Nuevo Porcentaje (% sobre ventas aprobadas):
                </label>
                <input
                  type="text"
                  value={newCommissionPct}
                  onChange={(e) => setNewCommissionPct(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 font-mono text-xs font-bold text-white"
                  placeholder="Ej. 5.5"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleUpdateCommissionRule}
              className="bo-gpu-transition rounded-xl bg-[#00F0FF] px-4 py-2.5 text-xs font-black text-black uppercase"
            >
              Guardar Nueva Vigencia de Comisión
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#FF2E63]" />
              Configurar Abono Mensual Fijo por Boliche
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400">
                  Nombre del Plan:
                </label>
                <input
                  type="text"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 text-xs font-bold text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400">
                  Importe Mensual (ARS):
                </label>
                <input
                  type="number"
                  value={newMonthlyFeePesos}
                  onChange={(e) => setNewMonthlyFeePesos(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-black px-3 py-2.5 font-mono text-xs font-bold text-white"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleUpdateMonthlyPlan}
              className="bo-gpu-transition rounded-xl bg-[#FF2E63] px-4 py-2.5 text-xs font-black text-white uppercase"
            >
              Actualizar Plan de Abono Mensual
            </button>
          </div>
        </section>

        {/* 3. Liquidaciones Semanales y Conciliación Manual de Pagos */}
        <section className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
          <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            Liquidaciones Semanales Emitidas y Registro Manual de Transferencias
          </h2>

          <div className="space-y-4">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-sm font-black text-white">
                      {s.settlementCode}
                    </span>
                    <span className="ml-2 text-xs font-bold text-slate-300">
                      • {s.fantasyName}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-black uppercase ${
                      s.status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : s.status === 'PARTIALLY_PAID'
                          ? 'bg-[#00F0FF]/20 text-[#00F0FF]'
                          : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-6">
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Pedidos Pagados</div>
                    <div className="tabular-nums font-bold text-white">
                      {formatArsFromCents(s.grossSalesCents)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Devoluciones/Ajustes</div>
                    <div className="tabular-nums font-bold text-rose-400">
                      -{formatArsFromCents(s.refundsAndAdjustmentsCents)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Base Comisionable</div>
                    <div className="tabular-nums font-bold text-white">
                      {formatArsFromCents(s.commissionableBaseCents)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Comisión BarraOnline</div>
                    <div className="tabular-nums font-black text-[#00F0FF]">
                      {formatArsFromCents(s.commissionDueCents)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Pagado Manual</div>
                    <div className="tabular-nums font-bold text-emerald-400">
                      {formatArsFromCents(s.amountPaidCents)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/5 p-2.5">
                    <div className="text-[10px] text-slate-400">Saldo Pendiente</div>
                    <div className="tabular-nums font-black text-amber-300">
                      {formatArsFromCents(s.balanceDueCents)}
                    </div>
                  </div>
                </div>

                {s.balanceDueCents > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <input
                      type="text"
                      value={paymentRefInput[s.id] ?? ''}
                      onChange={(e) =>
                        setPaymentRefInput((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                      placeholder="N° Comprobante / CBU Transferencia"
                      className="rounded-xl border border-white/15 bg-black px-3 py-2 font-mono text-xs text-white"
                    />
                    <input
                      type="number"
                      value={paymentAmountPesosInput[s.id] ?? ''}
                      onChange={(e) =>
                        setPaymentAmountPesosInput((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                      placeholder={`Importe ARS (Total: ${s.balanceDueCents / 100})`}
                      className="w-52 rounded-xl border border-white/15 bg-black px-3 py-2 font-mono text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRecordManualPayment(s)}
                      className="bo-gpu-transition rounded-xl bg-emerald-400 px-4 py-2 text-xs font-black text-black uppercase"
                    >
                      Registrar Pago Recibido y Conciliar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 4. Abonos Mensuales y Auditoría Administrativa */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-3">
            <h3 className="text-sm font-black text-white uppercase">
              Obligación Independiente: Abonos Mensuales (subscription_invoices)
            </h3>
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">
                      {sub.fantasyName} — Período {sub.billingPeriod}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Vence: {sub.dueDate} • Ref:{' '}
                      {sub.paymentReference || 'Pendiente de pago'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums font-black text-white">
                      {formatArsFromCents(sub.amountCents)}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                        sub.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-3">
            <h3 className="text-sm font-black text-white uppercase">
              Auditoría Administrativa Inmutable (audit_logs)
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-white/5 bg-black/40 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#00F0FF]">
                      {log.action}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {formatDateTimeAr(log.created_at)}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-300 truncate">
                    Rol: {log.actor_role} • {JSON.stringify(log.after_state)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
