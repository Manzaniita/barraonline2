'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Lock,
  Package,
  Receipt,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import {
  formatArsFromCents,
  formatBpsAsPercentage,
  formatDateTimeAr,
} from '@/lib/format';

interface OwnerProduct {
  id: string;
  name: string;
  category_name: string;
  price_cents: number;
  promo_price_cents: number | null;
  effective_price_cents: number;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
  available_stock: number;
}

interface OwnerOrder {
  id: string;
  orderNumber: string;
  customerDisplayName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  refundedCents: number;
  appliedCommissionBps: number;
  mpFeeCents: number;
  netReceivedByTenantCents: number;
  businessDate: string;
  createdAt: string;
}

interface LedgerRow {
  id: string;
  entryType: string;
  baseAmountCents: number;
  commissionBps: number;
  commissionAmountCents: number;
  isSettled: boolean;
  description: string;
  occurredAt: string;
}

interface SettlementRow {
  id: string;
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

export default function TenantOwnerAdminPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [tenantName, setTenantName] = useState(slug);
  const [mpConnection, setMpConnection] = useState<{
    mp_user_id: string;
    mp_public_key: string;
    connection_status: string;
    token_expires_at: string;
  } | null>(null);
  const [oauthUrl, setOauthUrl] = useState('');
  const [activeCommissionBps, setActiveCommissionBps] = useState(500);
  const [activePlan, setActivePlan] = useState<{
    planName: string;
    monthlyFeeCents: number;
  } | null>(null);

  const [products, setProducts] = useState<OwnerProduct[]>([]);
  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadOwnerDashboard() {
    const res = await fetch(`/api/v1/tenants/${slug}/owner`, {
      cache: 'no-store',
    });
    if (!res.ok) return;
    const data = await res.json();
    setTenantName(data.tenant?.fantasy_name || slug);
    setMpConnection(data.mpConnection || null);
    setOauthUrl(data.oauthAuthorizationUrl || '');
    setActiveCommissionBps(data.activeCommissionRule?.commission_bps ?? 500);
    setActivePlan(data.activePlan || null);
    setProducts(data.catalog?.products || []);
    setOrders(data.orders || []);
    setLedger(data.commissionLedger || []);
    setSettlements(data.settlements || []);
  }

  useEffect(() => {
    void loadOwnerDashboard();
  }, [slug]);

  async function handleQuickStockIncrease(product: OwnerProduct, delta: number) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PRODUCT',
          productId: product.id,
          stockTotal: product.stock_total + delta,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Error: ${data.error}`);
        return;
      }
      setFeedback(`Stock actualizado para "${product.name}".`);
      await loadOwnerDashboard();
    } finally {
      setBusy(false);
    }
  }

  async function handleExecuteRefund(order: OwnerOrder) {
    const refundable = order.totalCents - order.refundedCents;
    if (refundable <= 0) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REFUND_ORDER',
          orderId: order.id,
          refundAmountCents: refundable,
          refundReason: 'Devolución comercial ejecutada por Dueño del Boliche',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(`Error al reembolsar: ${data.error}`);
        return;
      }
      setFeedback(
        `Reembolso aprobado en Mercado Pago para #${order.orderNumber}. Asiento en Ledger: ${data.refundResult.ledgerEntryType} (-${formatArsFromCents(data.refundResult.commissionDeductedCents)} de comisión).`
      );
      await loadOwnerDashboard();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100">
      <header className="border-b border-white/10 bg-[#10131C] px-4 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/b/${slug}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#FF2E63] px-2.5 py-0.5 text-[11px] font-black text-white uppercase">
                  PANEL DEL DUEÑO
                </span>
                <h1 className="text-xl font-black text-white">{tenantName}</h1>
              </div>
              <p className="text-xs text-slate-400">
                Carta, Stock, Conexión OAuth Mercado Pago, Pedidos y Liquidaciones con
                BarraOnline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/b/${slug}`}
              className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
            >
              Ver Carta Móvil
            </Link>
            <Link
              href={`/b/${slug}/bar`}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300"
            >
              Abrir Consola Barra
            </Link>
            <Link
              href="/superadmin"
              className="rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-2 text-xs font-bold text-[#00F0FF]"
            >
              Panel Superadmin
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {feedback && (
          <div className="rounded-2xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 p-4 text-xs font-bold text-[#00F0FF]">
            {feedback}
          </div>
        )}

        {/* Resumen de Conexión Mercado Pago OAuth y Condiciones Comerciales */}
        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">
                Cuenta Mercado Pago del Boliche
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {mpConnection?.connection_status || 'CONNECTED'}
              </span>
            </div>
            <div className="font-mono text-sm font-bold text-white">
              Vendedor MP ID: {mpConnection?.mp_user_id || '—'}
            </div>
            <p className="text-xs text-slate-400">
              <Lock className="mr-1 inline h-3.5 w-3.5 text-[#00F0FF]" />
              Tokens OAuth cifrados en bóveda <strong>AES-256-GCM</strong> aislada por
              tenant. El 100% de las ventas acredita directo en esta cuenta sin Split.
            </p>
            <a
              href={oauthUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#009EE3] hover:underline"
            >
              Re-vincular OAuth 2.0 + PKCE (S256)
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-5 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Comisión Variable Contractual Vigente
            </span>
            <div className="tabular-nums text-3xl font-black text-white">
              {formatBpsAsPercentage(activeCommissionBps)}
            </div>
            <p className="text-xs text-slate-400">
              Calculada únicamente sobre pedidos aprobados menos devoluciones aplicables.
              Se liquida semanalmente.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-5 space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase">
              Abono Mensual SaaS (Obligación Independiente)
            </span>
            <div className="tabular-nums text-3xl font-black text-white">
              {activePlan ? formatArsFromCents(activePlan.monthlyFeeCents) : '—'}
            </div>
            <p className="text-xs text-slate-400">
              {activePlan?.planName || 'Plan Activo'} • Administrado de forma separada de
              la liquidación semanal de comisiones.
            </p>
          </div>
        </section>

        {/* Gestión de Carta y Stock en Tiempo Real */}
        <section className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
              <Package className="h-5 w-5 text-[#FF2E63]" />
              Catálogo e Inventario con Consistencia Transaccional PostgreSQL
            </h2>
            <button
              type="button"
              onClick={() => void loadOwnerDashboard()}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refrescar
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 pr-3">Bebida / Combo</th>
                  <th className="py-2.5 pr-3">Categoría</th>
                  <th className="py-2.5 pr-3">Precio Vigente</th>
                  <th className="py-2.5 pr-3">Stock Total</th>
                  <th className="py-2.5 pr-3">Reservado (Checkout)</th>
                  <th className="py-2.5 pr-3">Vendido (Pagado)</th>
                  <th className="py-2.5 pr-3">Stock Libre</th>
                  <th className="py-2.5">Ajuste Rápido Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {products.map((prod) => (
                  <tr key={prod.id}>
                    <td className="py-3 pr-3 font-bold text-white">{prod.name}</td>
                    <td className="py-3 pr-3 text-slate-400">{prod.category_name}</td>
                    <td className="py-3 pr-3 tabular-nums font-bold text-emerald-400">
                      {formatArsFromCents(prod.effective_price_cents)}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-mono text-white">
                      {prod.stock_total}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-mono text-amber-300">
                      {prod.stock_reserved}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-mono text-[#00F0FF]">
                      {prod.stock_sold}
                    </td>
                    <td className="py-3 pr-3 tabular-nums font-mono font-black text-emerald-400">
                      {prod.available_stock}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleQuickStockIncrease(prod, 20)}
                          className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/10"
                        >
                          +20 u.
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pedidos, Pagos Directos MP y Devoluciones */}
        <section className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
          <div>
            <h2 className="text-base font-black text-white uppercase flex items-center gap-2">
              <Receipt className="h-5 w-5 text-[#00F0FF]" />
              Pedidos, Desglose Bruto vs. Neto MP y Devoluciones
            </h2>
            <p className="text-xs text-slate-400">
              Transparencia contable: se muestra el importe bruto cobrado en carta (base
              comisionable), el neto acreditado por Mercado Pago y la comisión devengada.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 pr-3">N° Pedido</th>
                  <th className="py-2.5 pr-3">Noche Comercial</th>
                  <th className="py-2.5 pr-3">Estado Pago</th>
                  <th className="py-2.5 pr-3">Estado Retiro</th>
                  <th className="py-2.5 pr-3">Bruto Carta (Base)</th>
                  <th className="py-2.5 pr-3">Neto Acreditado MP</th>
                  <th className="py-2.5 pr-3">Reembolsado</th>
                  <th className="py-2.5">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => {
                  const canRefund =
                    (o.paymentStatus === 'APPROVED' ||
                      o.paymentStatus === 'PARTIALLY_REFUNDED') &&
                    o.totalCents > o.refundedCents;

                  return (
                    <tr key={o.id}>
                      <td className="py-3 pr-3 font-mono font-bold text-white">
                        {o.orderNumber}
                      </td>
                      <td className="py-3 pr-3 font-mono text-slate-400">
                        {o.businessDate}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                            o.paymentStatus === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : o.paymentStatus.includes('REFUND')
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-mono text-[11px] text-slate-300">
                          {o.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-3 tabular-nums font-bold text-white">
                        {formatArsFromCents(o.totalCents)}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-emerald-400">
                        {formatArsFromCents(o.netReceivedByTenantCents)}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-rose-400">
                        {o.refundedCents > 0
                          ? `-${formatArsFromCents(o.refundedCents)}`
                          : '$0'}
                      </td>
                      <td className="py-3">
                        {canRefund && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleExecuteRefund(o)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reembolsar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Liquidaciones Semanales y Libro Mayor de Comisiones del Boliche */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase">
              Mis Liquidaciones Semanales con BarraOnline
            </h3>
            <div className="space-y-3">
              {settlements.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-white">
                      {s.settlementCode}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        s.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                    <div>
                      Ventas Brutas: <strong>{formatArsFromCents(s.grossSalesCents)}</strong>
                    </div>
                    <div>
                      Devoluciones:{' '}
                      <strong className="text-rose-400">
                        -{formatArsFromCents(s.refundsAndAdjustmentsCents)}
                      </strong>
                    </div>
                    <div>
                      Base Comisionable:{' '}
                      <strong>{formatArsFromCents(s.commissionableBaseCents)}</strong>
                    </div>
                    <div>
                      Comisión BarraOnline:{' '}
                      <strong className="text-[#00F0FF]">
                        {formatArsFromCents(s.commissionDueCents)}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="text-slate-400">Vencimiento: {s.dueDate}</span>
                    <span className="font-bold text-white">
                      Saldo Pendiente: {formatArsFromCents(s.balanceDueCents)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#11131A] p-6 space-y-4">
            <h3 className="text-sm font-black text-white uppercase">
              Libro Mayor de Comisiones (commission_ledger)
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {ledger.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${
                          l.commissionAmountCents >= 0
                            ? 'bg-white/10 text-white'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {l.entryType}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {l.isSettled ? 'Incluido en liquidación' : 'Pendiente de corte'}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-300">{l.description}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <div
                      className={`font-mono font-black ${
                        l.commissionAmountCents >= 0 ? 'text-[#00F0FF]' : 'text-rose-400'
                      }`}
                    >
                      {l.commissionAmountCents >= 0 ? '+' : ''}
                      {formatArsFromCents(l.commissionAmountCents)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Base: {formatArsFromCents(l.baseAmountCents)} (
                      {formatBpsAsPercentage(l.commissionBps)})
                    </div>
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
