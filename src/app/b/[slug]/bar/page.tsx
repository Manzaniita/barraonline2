'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { formatArsFromCents, formatDateTimeAr } from '@/lib/format';

interface StaffMember {
  id: string;
  staff_display_name: string;
  role: string;
}

interface BarStation {
  id: string;
  name: string;
  sector: string;
}

interface RedemptionLog {
  id: string;
  attempted_token_prefix: string | null;
  attempt_result: string;
  details: string | null;
  created_at: string;
  staff_display_name: string | null;
  station_name: string | null;
}

interface OrderQuickPick {
  id: string;
  orderNumber: string;
  customerDisplayName: string;
  totalCents: number;
  qrRawToken: string | null;
  shortVerificationCode: string | null;
  qrStatus: string | null;
}

interface InspectResult {
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
  items?: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    substitutedByProductName: string | null;
  }>;
}

export default function BarConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050608] text-xs font-bold text-slate-400">
          Iniciando Consola Operativa de Barra...
        </div>
      }
    >
      <BarConsoleInner />
    </Suspense>
  );
}

function BarConsoleInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;

  const [tenantName, setTenantName] = useState<string>(slug);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [stations, setStations] = useState<BarStation[]>([]);
  const [recentLogs, setRecentLogs] = useState<RedemptionLog[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderQuickPick[]>([]);
  const [availableProducts, setAvailableProducts] = useState<
    Array<{ id: string; name: string; available_stock: number }>
  >([]);

  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [pinInput, setPinInput] = useState('482910');
  const [pinVerified, setPinVerified] = useState(true);

  const [qrInput, setQrInput] = useState('');
  const [inspectData, setInspectData] = useState<InspectResult | null>(null);
  const [selectedSubstituteProductId, setSelectedSubstituteProductId] =
    useState<string>('');
  const [actionBanner, setActionBanner] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'WARNING';
    title: string;
    detail: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadBarData() {
    const [barRes, catRes] = await Promise.all([
      fetch(`/api/v1/tenants/${slug}/bar`, { cache: 'no-store' }),
      fetch(`/api/v1/tenants/${slug}/catalog`, { cache: 'no-store' }),
    ]);

    if (barRes.ok) {
      const bData = await barRes.json();
      setTenantName(bData.tenant?.fantasy_name || slug);
      setStaffList(bData.staff || []);
      setStations(bData.stations || []);
      setRecentLogs(bData.recentLogs || []);
      setRecentOrders(bData.recentOrders || []);
      if (!selectedStaffId && bData.staff?.[0]?.id) {
        setSelectedStaffId(bData.staff[0].id);
      }
      if (!selectedStationId && bData.stations?.[0]?.id) {
        setSelectedStationId(bData.stations[0].id);
      }
    }

    if (catRes.ok) {
      const cData = await catRes.json();
      const inStockProds = (cData.products || []).filter(
        (p: { available_stock: number }) => p.available_stock > 0
      );
      setAvailableProducts(inStockProds);
      if (!selectedSubstituteProductId && inStockProds[0]?.id) {
        setSelectedSubstituteProductId(inStockProds[0].id);
      }
    }
  }

  useEffect(() => {
    void loadBarData();
  }, [slug]);

  useEffect(() => {
    const qrFromQuery = searchParams.get('qr');
    if (qrFromQuery && selectedStaffId) {
      setQrInput(qrFromQuery);
      void handleInspectToken(qrFromQuery);
    }
  }, [searchParams, selectedStaffId]);

  async function handleVerifyShiftPin() {
    if (!selectedStaffId) return;
    setBusy(true);
    setActionBanner(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTH_PIN',
          tenantUserId: selectedStaffId,
          pin: pinInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinVerified(false);
        setActionBanner({
          type: 'ERROR',
          title: 'PIN Operativo Rechazado',
          detail: data.error || 'PIN inválido',
        });
        return;
      }
      setPinVerified(true);
      setActionBanner({
        type: 'SUCCESS',
        title: 'Turno de Barra Activo',
        detail: `Operador verificado: ${data.authenticatedStaff.staff_display_name}`,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleInspectToken(tokenOverride?: string) {
    const tokenToScan = (tokenOverride ?? qrInput).trim();
    if (!tokenToScan || !selectedStaffId) return;
    setBusy(true);
    setActionBanner(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INSPECT',
          tenantUserId: selectedStaffId,
          stationId: selectedStationId || undefined,
          rawQrToken: tokenToScan,
        }),
      });
      const data = await res.json();
      if (data.inspection) {
        setInspectData(data.inspection);
      }
      await loadBarData();
    } finally {
      setBusy(false);
    }
  }

  async function handleRedeemNow() {
    if (!qrInput.trim() || !selectedStaffId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REDEEM',
          tenantUserId: selectedStaffId,
          stationId: selectedStationId || undefined,
          rawQrToken: qrInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.redemption?.outcome === 'REDEEMED_SUCCESSFULLY') {
        setActionBanner({
          type: 'SUCCESS',
          title: `¡ENTREGADO! PEDIDO #${data.redemption.orderNumber} QUEMADO ATÓMICAMENTE`,
          detail: `El QR quedó consumido en base de datos (${formatDateTimeAr(data.redemption.redeemedAt)}). Ninguna barra puede volver a entregarlo.`,
        });
      } else if (data.redemption?.outcome === 'REJECTED_ALREADY_REDEEMED') {
        setActionBanner({
          type: 'ERROR',
          title: '¡ALERTA ROJA! INTENTO DE DOBLE RETIRO BLOQUEADO',
          detail: `Ya fue entregado por ${data.redemption.previousRedemption?.redeemedByStaffName} en ${data.redemption.previousRedemption?.stationName} (${formatDateTimeAr(data.redemption.previousRedemption?.redeemedAt)}).`,
        });
      }
      await handleInspectToken(qrInput.trim());
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveStockConflict(mode: 'SUBSTITUTE' | 'REFUND') {
    if (!inspectData || !selectedStaffId) return;
    setBusy(true);
    try {
      const firstItemId = inspectData.items?.[0]?.id;
      const resolutionPayload =
        mode === 'SUBSTITUTE'
          ? {
              action: 'SUBSTITUTE' as const,
              orderItemId: firstItemId ?? '',
              substituteProductId: selectedSubstituteProductId,
              notes: 'Sustituto autorizado en mostrador de barra',
            }
          : {
              action: 'REFUND' as const,
              reason: 'Reembolso 100% en 1 clic solicitado en mostrador por falta de stock',
            };

      const res = await fetch(`/api/v1/tenants/${slug}/bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESOLVE_CONFLICT',
          tenantUserId: selectedStaffId,
          stationId: selectedStationId || undefined,
          rawQrToken: qrInput.trim(),
          resolution: resolutionPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionBanner({
          type: 'ERROR',
          title: 'No se pudo resolver el conflicto',
          detail: data.error || 'Error en resolución',
        });
        return;
      }

      setActionBanner({
        type: 'SUCCESS',
        title:
          mode === 'SUBSTITUTE'
            ? 'CONFLICTO RESUELTO CON BEBIDA SUSTITUTA Y QR QUEMADO'
            : 'REEMBOLSO 100% EJECUTADO EN MERCADO PAGO Y QR REVOCADO',
        detail:
          mode === 'SUBSTITUTE'
            ? 'Se descontó el stock del producto sustituto y el pedido quedó entregado.'
            : 'Se reembolsó el 100% al cliente y se registró el ajuste negativo en el libro mayor de comisiones.',
      });
      await handleInspectToken(qrInput.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050608] text-slate-100">
      {/* Barra Superior de Consola Nocturna */}
      <header className="border-b border-white/15 bg-[#0C0E14] px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/b/${slug}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-500 px-2 py-0.5 text-[11px] font-black text-black uppercase">
                  CONSOLA DE BARRA
                </span>
                <h1 className="text-lg font-black text-white">{tenantName}</h1>
              </div>
              <p className="text-xs text-slate-400">
                Consola Operativa de Barra • Validación y Entrega de Pedidos
              </p>
            </div>
          </div>

          {/* Selector de Terminal, Barman y PIN de Turno */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="rounded-xl border border-white/15 bg-black px-3 py-2 text-xs font-bold text-white"
            >
              {stations.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="rounded-xl border border-white/15 bg-black px-3 py-2 text-xs font-bold text-white"
            >
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.staff_display_name} ({s.role})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-black px-2 py-1">
              <KeyRound className="h-3.5 w-3.5 text-[#00F0FF]" />
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-16 bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
                placeholder="PIN"
              />
              <button
                type="button"
                onClick={handleVerifyShiftPin}
                className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                  pinVerified
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {pinVerified ? 'PIN OK' : 'Validar'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Banner de resultado de última operación */}
        {actionBanner && (
          <div
            className={`rounded-3xl border-2 p-5 ${
              actionBanner.type === 'SUCCESS'
                ? 'border-emerald-400 bg-emerald-950/60 text-emerald-100'
                : actionBanner.type === 'ERROR'
                  ? 'border-rose-500 bg-rose-950/70 text-rose-100'
                  : 'border-amber-400 bg-amber-950/60 text-amber-100'
            }`}
          >
            <div className="text-lg font-black uppercase">{actionBanner.title}</div>
            <p className="mt-1 text-sm font-medium">{actionBanner.detail}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Columna Izquierda: Lector Óptico / Selección Rápida de QRs del Boliche */}
          <section className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-white/15 bg-[#10131C] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black tracking-wide text-white uppercase flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-[#00F0FF]" />
                  Escáner QR / Lector Óptico
                </h2>
                <button
                  type="button"
                  onClick={() => void loadBarData()}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Actualizar
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400">
                  Token o URL leída por pistola / cámara:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Pegá o escaneá el QR aquí..."
                    className="flex-1 rounded-xl border border-white/20 bg-black px-3.5 py-3 font-mono text-xs text-white focus:border-[#00F0FF] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busy || !qrInput.trim()}
                    onClick={() => void handleInspectToken()}
                    className="bo-gpu-transition rounded-xl bg-[#00F0FF] px-4 py-3 text-xs font-black text-black uppercase disabled:opacity-40"
                  >
                    Verificar
                  </button>
                </div>
              </div>

              {/* Selección en 1 toque de QRs recientes para probar en vivo */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="text-xs font-bold text-slate-300">
                  Pedidos emitidos en {tenantName} (Tocá uno para escanearlo):
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {recentOrders
                    .filter((o) => o.qrRawToken)
                    .map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setQrInput(o.qrRawToken!);
                          void handleInspectToken(o.qrRawToken!);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/50 p-3 text-left transition hover:border-white/30"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-white">
                              #{o.orderNumber}
                            </span>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                                o.qrStatus === 'ACTIVE'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : o.qrStatus === 'STOCK_CONFLICT'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {o.qrStatus}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">
                            {o.customerDisplayName} •{' '}
                            {formatArsFromCents(o.totalCents)}
                          </div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#00F0FF]">
                          {o.shortVerificationCode}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </section>

          {/* Columna Derecha: Pantalla Gigante de Decisión del Barman */}
          <section className="lg:col-span-7">
            {!inspectData ? (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-[#10131C]/50 p-8 text-center">
                <QrCode className="h-14 w-14 text-slate-600" />
                <h3 className="mt-3 text-lg font-black text-slate-300">
                  Esperando lectura de QR en mostrador
                </h3>
                <p className="mt-1 max-w-md text-xs text-slate-500">
                  Seleccioná un pedido de la izquierda o escaneá el QR del celular del
                  cliente para ver las bebidas a preparar y confirmar el retiro atómico.
                </p>
              </div>
            ) : inspectData.lookupOutcome === 'READY_TO_REDEEM' ? (
              /* ESTADO 1: VERDE ESMERALDA — QR VÁLIDO LISTO PARA ENTREGAR Y QUEMAR */
              <div className="rounded-3xl border-4 border-emerald-400 bg-gradient-to-b from-emerald-950/70 to-[#10131C] p-6 shadow-[0_0_50px_rgba(16,185,129,0.25)] space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-3.5 py-1 text-xs font-black text-black uppercase">
                      <CheckCircle2 className="h-4 w-4" />
                      QR VÁLIDO • HABILITADO PARA ENTREGA INMEDIATA
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-white">
                      Pedido #{inspectData.orderNumber}
                    </h2>
                    <p className="text-xs text-emerald-200">
                      Cliente: <strong>{inspectData.customerDisplayName}</strong> • Pagado:{' '}
                      {formatDateTimeAr(inspectData.paidAt)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-black/60 px-4 py-2 text-center border border-emerald-400/40">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      Cód. Corto
                    </div>
                    <div className="font-mono text-2xl font-black text-emerald-400">
                      {inspectData.shortVerificationCode}
                    </div>
                  </div>
                </div>

                {/* Lista Gigante de Bebidas a Preparar/Entregar */}
                <div className="space-y-2.5 rounded-2xl bg-black/50 p-4 border border-white/10">
                  <div className="text-xs font-black tracking-wider text-slate-400 uppercase">
                    Bebidas a entregar en este retiro único:
                  </div>
                  {inspectData.items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 font-mono text-xl font-black text-black">
                          {item.quantity}x
                        </span>
                        <span className="text-lg font-black text-white">
                          {item.productName}
                        </span>
                      </div>
                      <span className="tabular-nums text-sm font-bold text-slate-300">
                        {formatArsFromCents(item.lineTotalCents)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Botón Gigante de 1 Solo Paso */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRedeemNow}
                  className="bo-gpu-transition flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-400 py-5 text-lg font-black tracking-wide text-black uppercase shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:bg-emerald-300 disabled:opacity-50"
                >
                  <Zap className="h-6 w-6" />
                  {busy
                    ? 'Confirmando entrega...'
                    : 'ENTREGAR BEBIDAS Y CONFIRMAR RETIRO'}
                </button>
              </div>
            ) : inspectData.lookupOutcome === 'ALREADY_REDEEMED' ? (
              /* ESTADO 2: ROJO ALERTA — QR YA UTILIZADO PREVIAMENTE */
              <div className="rounded-3xl border-4 border-rose-500 bg-gradient-to-b from-rose-950/80 to-[#10131C] p-6 shadow-[0_0_50px_rgba(239,68,68,0.3)] space-y-5">
                <div className="flex items-center gap-3">
                  <AlertOctagon className="h-12 w-12 shrink-0 text-rose-400" />
                  <div>
                    <span className="inline-block rounded-full bg-rose-500 px-3 py-0.5 text-xs font-black text-white uppercase">
                      BLOQUEADO • NO ENTREGAR BEBIDAS
                    </span>
                    <h2 className="mt-1 text-2xl font-black text-white">
                      ¡ESTE QR YA FUE RETIRADO ANTES!
                    </h2>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-500/40 bg-black/60 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pedido:</span>
                    <span className="font-mono font-bold text-white">
                      #{inspectData.orderNumber}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fecha y hora del canje previo:</span>
                    <span className="font-bold text-rose-300">
                      {formatDateTimeAr(inspectData.redeemedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Entregado por (Barman):</span>
                    <span className="font-bold text-white">
                      {inspectData.redeemedByStaffName || 'Staff autorizado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Terminal de Barra:</span>
                    <span className="font-bold text-white">
                      {inspectData.redeemedAtStationName || 'Barra Principal'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRedeemNow}
                  className="w-full rounded-xl border border-rose-500/40 bg-rose-500/10 py-3 text-xs font-bold text-rose-300 uppercase hover:bg-rose-500/20"
                >
                  Simular Intento de Re-Canje Forzado (Verificar rechazo y log de auditoría)
                </button>
              </div>
            ) : inspectData.lookupOutcome === 'STOCK_CONFLICT_REQUIRES_RESOLUTION' ? (
              /* ESTADO 3: ÁMBAR ALERTA — PAGO TARDÍO CON CONFLICTO DE STOCK */
              <div className="rounded-3xl border-4 border-amber-400 bg-gradient-to-b from-amber-950/75 to-[#10131C] p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-10 w-10 shrink-0 text-amber-400" />
                  <div>
                    <span className="rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black text-black uppercase">
                      PAGO APROBADO TARDÍO • CONFLICTO DE STOCK
                    </span>
                    <h2 className="mt-1 text-xl font-black text-white">
                      Pedido #{inspectData.orderNumber} — Resolver en Mostrador
                    </h2>
                    <p className="text-xs text-amber-100">
                      El cliente pagó {formatArsFromCents(inspectData.totalCents ?? 0)},
                      pero la confirmación de Mercado Pago llegó después de vencida la
                      reserva y se agotó el ítem original.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-black/50 p-4 border border-white/10 space-y-3">
                  <div className="text-xs font-bold text-amber-300 uppercase">
                    Opción A: Entregar Bebida Sustituta de Igual o Mayor Valor
                  </div>
                  <select
                    value={selectedSubstituteProductId}
                    onChange={(e) => setSelectedSubstituteProductId(e.target.value)}
                    className="w-full rounded-xl border border-white/20 bg-black px-3 py-2.5 text-xs font-bold text-white"
                  >
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock libre: {p.available_stock})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResolveStockConflict('SUBSTITUTE')}
                    className="bo-gpu-transition w-full rounded-xl bg-amber-400 py-3.5 text-xs font-black text-black uppercase"
                  >
                    Confirmar Entrega de Sustituto y Quemar QR
                  </button>
                </div>

                <div className="rounded-2xl bg-black/50 p-4 border border-rose-500/30 space-y-2">
                  <div className="text-xs font-bold text-rose-300 uppercase">
                    Opción B: Reembolso Inmediato del 100% en 1 Clic
                  </div>
                  <p className="text-xs text-slate-400">
                    Devuelve {formatArsFromCents(inspectData.totalCents ?? 0)} a la cuenta
                    de Mercado Pago del cliente, revoca el QR y descuenta la comisión del
                    boliche.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResolveStockConflict('REFUND')}
                    className="bo-gpu-transition w-full rounded-xl border border-rose-500/50 bg-rose-500/20 py-3 text-xs font-black text-rose-200 uppercase hover:bg-rose-500/30"
                  >
                    Disparar Reembolso 100% en Mercado Pago
                  </button>
                </div>
              </div>
            ) : (
              /* ESTADO 4: TOKEN INVÁLIDO O DE OTRO BOLICHE */
              <div className="rounded-3xl border-4 border-rose-600 bg-rose-950/70 p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-10 w-10 text-rose-400" />
                  <div>
                    <h2 className="text-xl font-black text-white">
                      {inspectData.lookupOutcome === 'WRONG_TENANT'
                        ? '¡ALERTA! QR EMITIDO PARA OTRO BOLICHE'
                        : 'QR INVÁLIDO O REEMBOLSADO'}
                    </h2>
                    <p className="text-xs text-rose-200">
                      Estado detectado: <strong>{inspectData.lookupOutcome}</strong>. El
                      intento quedó registrado en la auditoría de seguridad.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Registro de Auditoría de Escaneos en Tiempo Real (qr_redemption_logs) */}
        <section className="rounded-3xl border border-white/10 bg-[#10131C] p-5 space-y-3">
          <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase">
            Registro de Intentos y Entregas en Barra
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2 pr-3">Fecha/Hora</th>
                  <th className="py-2 pr-3">Resultado</th>
                  <th className="py-2 pr-3">Prefijo Token</th>
                  <th className="py-2 pr-3">Barman</th>
                  <th className="py-2 pr-3">Terminal</th>
                  <th className="py-2">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">
                      {formatDateTimeAr(log.created_at)}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                          log.attempt_result.startsWith('SUCCESS')
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : log.attempt_result.includes('CONFLICT')
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {log.attempt_result}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-300">
                      {log.attempted_token_prefix || '—'}...
                    </td>
                    <td className="py-2 pr-3 text-slate-200">
                      {log.staff_display_name || '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">
                      {log.station_name || '—'}
                    </td>
                    <td className="py-2 text-slate-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
