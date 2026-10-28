'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Minus,
  Plus,
  QrCode,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { formatArsFromCents } from '@/lib/format';

interface CatalogCategory {
  id: string;
  name: string;
  badge_text: string | null;
}

interface CatalogProduct {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string;
  is_alcoholic: boolean;
  price_cents: number;
  promo_price_cents: number | null;
  effective_price_cents: number;
  promo_label: string | null;
  available_stock: number;
  in_stock: boolean;
  max_per_order: number;
}

interface TenantData {
  id: string;
  slug: string;
  fantasy_name: string;
  legal_name: string;
  city: string;
  status: string;
  reservation_ttl_seconds: number;
  theme_config: {
    accentPrimary: string;
    accentSecondary: string;
    accentOnPrimary: string;
    tagline: string;
    heroBadge: string;
    logoText: string;
  };
}

interface ActiveOrderQrPass {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  qrId: string;
  qrRawToken: string;
  qrShortCode: string;
  qrStatus: 'ACTIVE' | 'STOCK_CONFLICT' | 'REDEEMED' | 'REVOKED_REFUND';
  totalCents: number;
  commissionChargedCents?: number;
}

export default function TenantPublicMenuPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [ageVerified, setAgeVerified] = useState(true);

  // Carrito e Identidad opcional
  const [cart, setCart] = useState<Record<string, number>>({});
  const [authMode, setAuthMode] = useState<'GUEST' | 'GOOGLE'>('GUEST');
  const [customerName, setCustomerName] = useState('Invitado Pista');
  const [recoveryContact, setRecoveryContact] = useState('');

  // Estados de Checkout y Reserva Temporal
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{
    orderId: string;
    orderNumber: string;
    totalCents: number;
    reservationExpiresAt: string;
    preferenceId: string;
    initPointUrl: string;
    mpPayload: Record<string, unknown>;
  } | null>(null);

  const [activeQrPass, setActiveQrPass] = useState<ActiveOrderQrPass | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  async function loadCatalog() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/catalog`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data.tenant) {
        setTenant(data.tenant);
        setCategories(data.categories || []);
        setProducts(data.products || []);
      } else {
        setErrorMsg(data.message || 'No se pudo cargar la carta del boliche.');
      }
    } catch {
      setErrorMsg('Error de red al conectar con el boliche.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, [slug]);

  useEffect(() => {
    if (!activeQrPass?.qrRawToken || !tenant) return;
    const qrTargetUri = `https://${tenant.slug}.barraonline.com.ar/r/${activeQrPass.qrRawToken}`;
    QRCode.toDataURL(qrTargetUri, {
      width: 320,
      margin: 3,
      color: {
        dark: '#070709',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => undefined);
  }, [activeQrPass, tenant]);

  const accent = tenant?.theme_config?.accentPrimary || '#FF2E63';
  const accentText = tenant?.theme_config?.accentOnPrimary || '#FFFFFF';

  const filteredProducts = useMemo(() => {
    if (selectedCategoryId === 'ALL') return products;
    return products.filter((p) => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId]);

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalCents = 0;
    const lines: Array<{ product: CatalogProduct; quantity: number }> = [];
    for (const [productId, qty] of Object.entries(cart)) {
      if (qty <= 0) continue;
      const prod = products.find((p) => p.id === productId);
      if (!prod) continue;
      totalItems += qty;
      totalCents += prod.effective_price_cents * qty;
      lines.push({ product: prod, quantity: qty });
    }
    return { totalItems, totalCents, lines };
  }, [cart, products]);

  function updateQuantity(product: CatalogProduct, delta: number) {
    setErrorMsg(null);
    setCart((prev) => {
      const current = prev[product.id] ?? 0;
      const next = Math.max(
        0,
        Math.min(product.max_per_order, product.available_stock, current + delta)
      );
      if (next === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }
      return { ...prev, [product.id]: next };
    });
  }

  async function handleStartCheckout() {
    if (cartSummary.lines.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `ui-chk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
        body: JSON.stringify({
          action: 'CREATE_CHECKOUT',
          customerDisplayName:
            authMode === 'GOOGLE' ? 'Camila R. (Google OAuth)' : customerName,
          guestRecoveryContact: recoveryContact,
          items: cartSummary.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo iniciar el checkout.');
        return;
      }

      setPendingCheckout({
        orderId: data.checkout.orderId,
        orderNumber: data.checkout.orderNumber,
        totalCents: data.checkout.totalCents,
        reservationExpiresAt: data.checkout.reservationExpiresAt,
        preferenceId: data.mpPreference.preferenceId,
        initPointUrl: data.mpPreference.initPointUrl,
        mpPayload: data.mpPreference.requestPayloadSentToMp,
      });
      await loadCatalog();
    } catch {
      setErrorMsg('Error de conexión al reservar stock.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmMercadoPagoPayment() {
    if (!pendingCheckout) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONFIRM_PAYMENT',
          orderId: pendingCheckout.orderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al confirmar el pago.');
        return;
      }

      setActiveQrPass({
        ...data.confirmation,
        totalCents: pendingCheckout.totalCents,
      });
      setPendingCheckout(null);
      setCart({});
      await loadCatalog();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSimulateLateStockConflict() {
    const targetLines =
      cartSummary.lines.length > 0
        ? cartSummary.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          }))
        : products[0]
          ? [{ productId: products[0].id, quantity: 1 }]
          : [];

    if (targetLines.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SIMULATE_LATE_CONFLICT',
          customerDisplayName: 'Cliente (Pago Tardío sin Stock)',
          items: targetLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al simular conflicto.');
        return;
      }

      setActiveQrPass({
        ...data.confirmation,
        totalCents: data.checkout.totalCents,
      });
      setPendingCheckout(null);
      setCart({});
      await loadCatalog();
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadOfflineQrPng() {
    if (!qrDataUrl || !activeQrPass) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-${activeQrPass.orderNumber}.png`;
    link.click();
  }

  if (loading && !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070709] p-6 text-slate-300">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="h-3 w-3 animate-ping rounded-full bg-[#FF2E63]" />
          Cargando carta nocturna del establecimiento...
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070709] p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h1 className="text-2xl font-black text-white">Boliche no encontrado</h1>
        <Link
          href="/"
          className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white"
        >
          Volver al directorio central
        </Link>
      </div>
    );
  }

  return (
    <div
      style={
        {
          '--bo-accent-primary': accent,
          '--bo-accent-on-primary': accentText,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[#070709] pb-40 text-slate-100"
    >
      {/* Header Móvil del Boliche */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070709]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white"
              title="Directorio BarraOnline"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">
                  {tenant.fantasy_name}
                </span>
                <span
                  style={{ backgroundColor: `${accent}25`, color: accent }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase"
                >
                  {tenant.theme_config.heroBadge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {tenant.slug}.barraonline.com.ar • {tenant.city}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/b/${tenant.slug}/bar`}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 uppercase"
            >
              Barra
            </Link>
            <Link
              href={`/b/${tenant.slug}/admin`}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 uppercase"
            >
              Dueño
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-5">
        {/* Aviso Legal Ley 24.788 (+18) */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#11131A] px-3.5 py-2.5 text-xs text-slate-300">
          <span>
            <strong className="text-white">+18 Ley 24.788:</strong> Prohibida la venta y
            entrega de alcohol a menores de 18 años.
          </span>
          <button
            type="button"
            onClick={() => setAgeVerified(true)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
              ageVerified
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            Soy +18 ✓
          </button>
        </div>

        {/* Selector Invitado vs Google Opcional (Cero barrera de entrada) */}
        <section className="rounded-2xl border border-white/10 bg-[#11131A] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <UserCheck className="h-4 w-4 text-[#00F0FF]" />
              Modo de compra:
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAuthMode('GUEST')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  authMode === 'GUEST'
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Invitado Rápido (Sin cuenta)
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('GOOGLE')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  authMode === 'GOOGLE'
                    ? 'bg-[#00F0FF] text-black'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                Vincular Google (Opcional)
              </button>
            </div>
          </div>

          {authMode === 'GUEST' && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre o apodo para barra"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
              <input
                type="text"
                value={recoveryContact}
                onChange={(e) => setRecoveryContact(e.target.value)}
                placeholder="WhatsApp o Email (opcional p/ recuperar QR)"
                className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />
            </div>
          )}
        </section>

        {errorMsg && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 p-3.5 text-xs font-semibold text-rose-200">
            {errorMsg}
          </div>
        )}

        {/* Modal / Tarjeta de Pase QR Emitido (Activo o Conflicto de Stock) */}
        {activeQrPass && (
          <section
            className={`rounded-3xl border-2 p-5 shadow-2xl ${
              activeQrPass.qrStatus === 'STOCK_CONFLICT'
                ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 to-[#11131A]'
                : 'border-emerald-400 bg-gradient-to-b from-emerald-950/50 to-[#11131A]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase ${
                    activeQrPass.qrStatus === 'STOCK_CONFLICT'
                      ? 'bg-amber-400 text-black'
                      : 'bg-emerald-400 text-black'
                  }`}
                >
                  {activeQrPass.qrStatus === 'STOCK_CONFLICT' ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      QR CON PRIORIDAD: CONFLICTO DE STOCK TARDÍO
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      PAGO APROBADO • QR DE USO ÚNICO ACTIVO
                    </>
                  )}
                </span>
                <h2 className="mt-2 text-xl font-black text-white">
                  Pedido #{activeQrPass.orderNumber}
                </h2>
                <p className="text-xs text-slate-300">
                  Presentá este QR en cualquier barra de{' '}
                  <strong>{tenant.fantasy_name}</strong>. Se invalida atómicamente en el
                  primer escaneo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveQrPass(null)}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-300"
              >
                Cerrar
              </button>
            </div>

            {activeQrPass.qrStatus === 'STOCK_CONFLICT' && (
              <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3 text-xs text-amber-100">
                <strong>¿Qué pasó?</strong> Mercado Pago confirmó tu pago después de que
                venció la reserva temporal y se agotó la última unidad. Acercate a la
                barra con este QR: el encargado te entregará una{' '}
                <strong>bebida sustituta equivalente en el acto</strong> o disparará tu{' '}
                <strong>reembolso del 100% con un clic</strong>.
              </div>
            )}

            {/* Contenedor Blanco Puro (#FFFFFF) de Alto Contraste para Lectura Óptica Instantánea */}
            <div className="my-5 flex flex-col items-center justify-center">
              <div className="rounded-3xl bg-white p-4 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Pedido ${activeQrPass.orderNumber}`}
                    className="h-56 w-56 object-contain"
                  />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center text-xs font-bold text-black">
                    Generando QR seguro...
                  </div>
                )}
              </div>
              <div className="mt-3 text-center">
                <div className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                  Código Corto de Verificación
                </div>
                <div className="font-mono text-2xl font-black tracking-widest text-white">
                  {activeQrPass.qrShortCode}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                  Token: {activeQrPass.qrRawToken}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownloadOfflineQrPng}
                className="bo-gpu-transition flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold text-white uppercase hover:bg-white/15"
              >
                <Download className="h-4 w-4" />
                Guardar Pase Offline (PNG)
              </button>

              <Link
                href={`/b/${tenant.slug}/bar?qr=${encodeURIComponent(activeQrPass.qrRawToken)}`}
                className="bo-gpu-transition flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-black uppercase shadow-lg"
              >
                <QrCode className="h-4 w-4" />
                Escanear Ahora en Consola Barra
              </Link>
            </div>
          </section>
        )}

        {/* Estado de Espera Activa de Checkout + Inspector de Preferencia Mercado Pago */}
        {pendingCheckout && (
          <section className="rounded-3xl border border-[#00F0FF]/50 bg-[#11131A] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF]/20 px-3 py-1 text-xs font-bold text-[#00F0FF]">
                  <Clock className="h-3.5 w-3.5" />
                  STOCK RESERVADO TEMPORALMENTE • ESPERANDO PAGO MP
                </span>
                <h2 className="mt-2 text-lg font-black text-white">
                  Pedido #{pendingCheckout.orderNumber} —{' '}
                  <span className="tabular-nums text-[#00F0FF]">
                    {formatArsFromCents(pendingCheckout.totalCents)}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Tu stock está bloqueado hasta{' '}
                  {new Date(pendingCheckout.reservationExpiresAt).toLocaleTimeString(
                    'es-AR'
                  )}
                  . No hace falta volver a cargar el carrito.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-white">
                <span>Preferencia Mercado Pago (Cuenta directa del boliche)</span>
                <span className="font-mono text-[11px] text-emerald-400">
                  binary_mode: true • split: NO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                El 100% del pago se acredita en la cuenta OAuth de{' '}
                <strong>{tenant.fantasy_name}</strong>. BarraOnline registra la comisión en
                su libro mayor para la liquidación semanal.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmMercadoPagoPayment}
                className="bo-gpu-transition flex items-center justify-center gap-2 rounded-xl bg-[#009EE3] px-4 py-3.5 text-xs font-black text-white uppercase shadow-lg hover:bg-[#008ED0] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting
                  ? 'Confirmando con MP...'
                  : 'Confirmar Pago Aprobado en Mercado Pago'}
              </button>

              <a
                href={pendingCheckout.initPointUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-xs font-bold text-slate-300 uppercase hover:bg-white/10"
              >
                Ver URL Checkout Pro
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>
        )}

        {/* Categorías One-Thumb */}
        <nav
          aria-label="Categorías de la carta"
          className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            style={
              selectedCategoryId === 'ALL'
                ? { backgroundColor: accent, color: accentText }
                : undefined
            }
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black uppercase transition ${
              selectedCategoryId === 'ALL'
                ? 'shadow-lg'
                : 'border border-white/10 bg-[#11131A] text-slate-300 hover:text-white'
            }`}
          >
            Toda la Carta
          </button>
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                style={
                  active ? { backgroundColor: accent, color: accentText } : undefined
                }
                className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black uppercase transition ${
                  active
                    ? 'shadow-lg'
                    : 'border border-white/10 bg-[#11131A] text-slate-300 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </nav>

        {/* Lista de Bebidas y Combos */}
        <section className="space-y-3">
          {filteredProducts.map((product) => {
            const qtyInCart = cart[product.id] ?? 0;
            const hasPromo = product.promo_price_cents !== null;

            return (
              <div
                key={product.id}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                  qtyInCart > 0
                    ? 'border-white/30 bg-[#171A24]'
                    : 'border-white/10 bg-[#11131A]'
                } ${!product.in_stock ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {product.promo_label && (
                      <span
                        style={{ backgroundColor: accent, color: accentText }}
                        className="rounded-md px-2 py-0.5 text-[10px] font-black uppercase"
                      >
                        {product.promo_label}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-400">
                      {product.category_name}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-white leading-snug">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="tabular-nums text-lg font-black text-white">
                      {formatArsFromCents(product.effective_price_cents)}
                    </span>
                    {hasPromo && (
                      <span className="tabular-nums text-xs text-slate-500 line-through">
                        {formatArsFromCents(product.price_cents)}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-emerald-400">
                      • {product.in_stock ? 'Disponible en barra' : 'Agotado'}
                    </span>
                  </div>
                </div>

                {/* Controles táctiles de 44x44px en zona del pulgar derecho */}
                <div className="flex items-center gap-2">
                  {qtyInCart > 0 && (
                    <>
                      <button
                        type="button"
                        aria-label={`Quitar ${product.name}`}
                        onClick={() => updateQuantity(product, -1)}
                        className="bo-gpu-transition flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="tabular-nums w-6 text-center text-base font-black text-white">
                        {qtyInCart}
                      </span>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!product.in_stock}
                    aria-label={`Agregar ${product.name}`}
                    onClick={() => updateQuantity(product, 1)}
                    style={{ backgroundColor: accent, color: accentText }}
                    className="bo-gpu-transition flex h-11 w-11 items-center justify-center rounded-xl font-black shadow-md disabled:opacity-40"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Simulador rápido de caso borde: Pago tardío con Stock Agotado */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200/90 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300 uppercase">
            <Sparkles className="h-4 w-4" />
            Laboratorio de Resiliencia (Caso Borde Sección 8 del Prompt)
          </div>
          <p className="text-slate-300">
            ¿Querés probar qué pasa cuando la reserva de stock vence y Mercado Pago
            confirma el pago tardíamente cuando ya se agotó la última botella?
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSimulateLateStockConflict}
            className="bo-gpu-transition rounded-xl border border-amber-400/50 bg-amber-400/15 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/25"
          >
            Simular Pago Tardío con Stock Agotado (Emitir QR en STOCK_CONFLICT)
          </button>
        </section>
      </main>

      {/* Barra Flotante Inferior One-Thumb para Iniciar Checkout */}
      {cartSummary.totalItems > 0 && !pendingCheckout && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#11131A]/95 p-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-400">
                {cartSummary.totalItems}{' '}
                {cartSummary.totalItems === 1 ? 'bebida' : 'bebidas'} en tu pedido
              </div>
              <div className="tabular-nums text-2xl font-black text-white">
                {formatArsFromCents(cartSummary.totalCents)}
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleStartCheckout}
              style={{ backgroundColor: accent, color: accentText }}
              className="bo-gpu-transition flex items-center gap-2.5 rounded-2xl px-6 py-4 text-sm font-black tracking-wide uppercase shadow-[0_0_30px_rgba(255,46,99,0.5)] disabled:opacity-50"
            >
              <ShoppingBag className="h-5 w-5" />
              {submitting ? 'Reservando Stock...' : 'Pagar con Mercado Pago'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
