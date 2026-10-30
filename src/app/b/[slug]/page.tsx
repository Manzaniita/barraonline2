'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Flame,
  GlassWater,
  History,
  Loader2,
  MapPin,
  Minus,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { formatArsFromCents } from '@/lib/format';
import { LogoutModal } from '@/components/auth/LogoutModal';
import { LogOut } from 'lucide-react';

interface CatalogCategory {
  id: string;
  name: string;
  badge_text: string | null;
  sort_order: number;
}

interface CatalogProduct {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string;
  image_url: string | null;
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
  city: string;
  address?: string;
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

interface CustomerIdentity {
  fullName: string;
  email: string | null;
  avatarUrl: string | null;
  provider: 'GOOGLE' | 'EXPRESS_SESSION';
}

interface DraftValidationNotice {
  type: 'PRICE_CHANGED' | 'REMOVED_OUT_OF_STOCK' | 'QUANTITY_ADJUSTED';
  productId: string;
  productName: string;
  message: string;
}

interface RecoveredDraftData {
  draftId: string;
  savedStep: number;
  customerDisplayName: string | null;
  validatedItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    regularPriceCents: number;
    availableStock: number;
    maxPerOrder: number;
    lineTotalCents: number;
  }>;
  previousSubtotalCents: number;
  currentSubtotalCents: number;
  currentDiscountCents: number;
  currentTotalCents: number;
  hasChanges: boolean;
  notices: DraftValidationNotice[];
  canRecoverAcrossDevices: boolean;
}

interface AuthorizedOrderView {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  customerDisplayName: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  reservationStatus: string | null;
  reservationExpiresAt: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    substitutedByProductName: string | null;
  }>;
  qr: {
    qrId: string;
    qrRawToken: string;
    qrShortCode: string;
    qrStatus: 'ACTIVE' | 'STOCK_CONFLICT' | 'REDEEMED' | 'REVOKED_REFUND' | 'EXPIRED';
    issuedAt: string;
    redeemedAt: string | null;
  } | null;
}

type ExpressStep = 1 | 2 | 3 | 4;

const EXPRESS_STEPS: Array<{
  step: ExpressStep;
  shortLabel: string;
  title: string;
}> = [
  { step: 1, shortLabel: 'Elegí', title: 'Elegí tus tragos' },
  { step: 2, shortLabel: 'Identificate', title: 'Identificate' },
  { step: 3, shortLabel: 'Pagá', title: 'Pagá en segundos' },
  { step: 4, shortLabel: 'Tu QR', title: 'Obtené tu QR y retiralo' },
];

function BarraOnlineExpressContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('FEATURED');

  // Estado del flujo guiado de 4 pasos (BarraOnline Express)
  const [currentStep, setCurrentStep] = useState<ExpressStep>(1);

  // Selección de productos (persiste entre pasos y cambios de categoría)
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartPulse, setCartPulse] = useState(false);
  const [lastUpdatedProductId, setLastUpdatedProductId] = useState<string | null>(
    null
  );

  // Sesión de usuario e identificación (Paso 2)
  const [customer, setCustomer] = useState<CustomerIdentity | null>(null);
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickContact, setQuickContact] = useState('');
  const [showQuickIdentifyForm, setShowQuickIdentifyForm] = useState(false);

  // Borradores ("Guardar y continuar después") y Pedidos / QRs del usuario
  const [savedDraft, setSavedDraft] = useState<RecoveredDraftData | null>(null);
  const [draftSavedBanner, setDraftSavedBanner] = useState<{
    canRecoverAcrossDevices: boolean;
    expiresAt: string;
  } | null>(null);
  const [revalidationNotices, setRevalidationNotices] = useState<string[]>([]);
  const [recentOrders, setRecentOrders] = useState<AuthorizedOrderView[]>([]);
  const [showMyOrdersDrawer, setShowMyOrdersDrawer] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Estados de Pago (Paso 3) y QR Confirmado (Paso 4)
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkoutAttemptCounter, setCheckoutAttemptCounter] = useState(1);

  const [activeCheckout, setActiveCheckout] = useState<{
    orderId: string;
    orderNumber: string;
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    reservationExpiresAt: string;
    preferenceId: string;
    initPointUrl: string;
    paymentState: 'READY_TO_PAY' | 'REDIRECTED_MP' | 'PENDING_REVIEW' | 'REJECTED';
  } | null>(null);

  const [confirmedOrder, setConfirmedOrder] =
    useState<AuthorizedOrderView | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [refreshingOrderStatus, setRefreshingOrderStatus] = useState(false);

  const hydratedCartRef = useRef(false);

  // Clave de almacenamiento local por establecimiento para no perder selección en redirección OAuth
  const localCartKey = `bo_express_cart_${slug}`;

  const loadCatalogAndSession = useCallback(async () => {
    try {
      const [catRes, sessRes] = await Promise.all([
        fetch(`/api/v1/tenants/${slug}/catalog`, { cache: 'no-store' }),
        fetch(`/api/v1/tenants/${slug}/session`, { cache: 'no-store' }),
      ]);

      const catData = await catRes.json();
      if (catRes.ok && catData.tenant) {
        setTenant(catData.tenant);
        setCategories(catData.categories || []);
        setProducts(catData.products || []);
      } else {
        setErrorMsg(
          catData.message || 'No se pudo cargar la carta del establecimiento.'
        );
      }

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setCustomer(sessData.customer ?? null);
        setGoogleOAuthConfigured(Boolean(sessData.googleOAuthConfigured));
        if (sessData.customer?.fullName) {
          setQuickName(sessData.customer.fullName);
        }
        if (sessData.activeDraft) {
          setSavedDraft(sessData.activeDraft);
        }
        if (Array.isArray(sessData.recentOrders)) {
          setRecentOrders(sessData.recentOrders);
        }
      }
    } catch {
      setErrorMsg('No pudimos conectar con el establecimiento. Verificá tu señal.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadCatalogAndSession();
  }, [loadCatalogAndSession]);

  // Restauramos selección guardada en el navegador (ej. al volver de Google OAuth)
  useEffect(() => {
    if (hydratedCartRef.current || products.length === 0) return;
    hydratedCartRef.current = true;

    try {
      const rawStored = window.sessionStorage.getItem(localCartKey);
      if (rawStored) {
        const parsed = JSON.parse(rawStored) as Record<string, number>;
        const sanitized: Record<string, number> = {};
        for (const [pid, qty] of Object.entries(parsed)) {
          const prod = products.find((p) => p.id === pid);
          if (prod && prod.in_stock && qty > 0) {
            sanitized[pid] = Math.min(
              qty,
              prod.available_stock,
              prod.max_per_order
            );
          }
        }
        if (Object.keys(sanitized).length > 0) {
          setCart(sanitized);
        }
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }

    // Si regresó de Google OAuth o indicó un paso en la URL
    const stepFromUrl = searchParams.get('step');
    const authNotice = searchParams.get('auth_notice');
    const mpOrderReturn = searchParams.get('orderId');

    if (authNotice === 'google_credentials_missing') {
      setCurrentStep(2);
      setShowQuickIdentifyForm(true);
    } else if (stepFromUrl === '3') {
      setCurrentStep(3);
    } else if (stepFromUrl === '2') {
      setCurrentStep(2);
    }

    // Si el cliente vuelve desde una redirección externa con orderId, NUNCA asumimos pago exitoso sin verificar en backend
    if (mpOrderReturn) {
      void verifyOrderFromBackend(mpOrderReturn);
    }
  }, [products, localCartKey, searchParams]);

  // Persistimos cambios de selección en sessionStorage para sobrevivir redirecciones OAuth
  useEffect(() => {
    if (!hydratedCartRef.current) return;
    try {
      if (Object.keys(cart).length === 0) {
        window.sessionStorage.removeItem(localCartKey);
      } else {
        window.sessionStorage.setItem(localCartKey, JSON.stringify(cart));
      }
    } catch {
      // Ignorar
    }
  }, [cart, localCartKey]);

  // Generamos el QR de alto contraste únicamente cuando el pedido confirmado tiene qrRawToken real emitido por el backend
  useEffect(() => {
    if (
      !confirmedOrder?.qr?.qrRawToken ||
      confirmedOrder.paymentStatus !== 'APPROVED' ||
      !tenant
    ) {
      setQrDataUrl('');
      return;
    }
    const qrTargetUri = `https://${tenant.slug}.barraonline.com.ar/r/${confirmedOrder.qr.qrRawToken}`;
    QRCode.toDataURL(qrTargetUri, {
      width: 340,
      margin: 3,
      color: {
        dark: '#070709',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => undefined);
  }, [confirmedOrder, tenant]);

  const accent = tenant?.theme_config?.accentPrimary || '#FF2E63';
  const accentSecondary = tenant?.theme_config?.accentSecondary || '#00F0FF';
  const accentText = tenant?.theme_config?.accentOnPrimary || '#FFFFFF';

  // Productos destacados definidos por el establecimiento (promociones o primera categoría destacada)
  const featuredCategoryIds = useMemo(() => {
    const withBadge = categories.filter((c) => Boolean(c.badge_text)).map((c) => c.id);
    if (withBadge.length > 0) return new Set(withBadge);
    return new Set(categories.slice(0, 1).map((c) => c.id));
  }, [categories]);

  const displayedProducts = useMemo(() => {
    if (selectedCategoryId === 'ALL') {
      return products;
    }
    if (selectedCategoryId === 'FEATURED') {
      const featured = products.filter(
        (p) => p.promo_price_cents !== null || featuredCategoryIds.has(p.category_id)
      );
      return featured.length > 0 ? featured : products;
    }
    return products.filter((p) => p.category_id === selectedCategoryId);
  }, [products, selectedCategoryId, featuredCategoryIds]);

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let regularSubtotalCents = 0;
    let discountCents = 0;
    let totalCents = 0;
    const lines: Array<{
      product: CatalogProduct;
      quantity: number;
      lineRegularCents: number;
      lineTotalCents: number;
      lineDiscountCents: number;
    }> = [];

    for (const [productId, qty] of Object.entries(cart)) {
      if (qty <= 0) continue;
      const prod = products.find((p) => p.id === productId);
      if (!prod || !prod.in_stock) continue;
      const clampedQty = Math.min(qty, prod.available_stock, prod.max_per_order);
      if (clampedQty <= 0) continue;

      const lineRegularCents = prod.price_cents * clampedQty;
      const lineTotalCents = prod.effective_price_cents * clampedQty;
      const lineDiscountCents = Math.max(0, lineRegularCents - lineTotalCents);

      totalItems += clampedQty;
      regularSubtotalCents += lineRegularCents;
      discountCents += lineDiscountCents;
      totalCents += lineTotalCents;

      lines.push({
        product: prod,
        quantity: clampedQty,
        lineRegularCents,
        lineTotalCents,
        lineDiscountCents,
      });
    }

    return {
      totalItems,
      regularSubtotalCents,
      discountCents,
      totalCents,
      lines,
    };
  }, [cart, products]);

  // Clave determinística de idempotencia vinculada al contenido exacto del pedido y al intento actual
  const currentIdempotencyKey = useMemo(() => {
    const signature = cartSummary.lines
      .map(
        (l) =>
          `${l.product.id.slice(0, 8)}:${l.quantity}:${l.product.effective_price_cents}`
      )
      .sort()
      .join('|');
    return `bo-exp-${slug}-${checkoutAttemptCounter}-${signature.slice(0, 36)}`;
  }, [cartSummary.lines, slug, checkoutAttemptCounter]);

  function updateQuantity(product: CatalogProduct, delta: number) {
    if (!product.in_stock && delta > 0) return;
    setErrorMsg(null);
    setDraftSavedBanner(null);

    setCart((prev) => {
      const current = prev[product.id] ?? 0;
      const maxAllowed = Math.min(product.max_per_order, product.available_stock);
      const next = Math.max(0, Math.min(maxAllowed, current + delta));
      if (next === current) return prev;

      if (next === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }
      return { ...prev, [product.id]: next };
    });

    // Si había una preferencia de pago previa pendiente de iniciar y el cliente editó cantidades, limpiamos la reserva local para revalidar al pagar
    if (activeCheckout && activeCheckout.paymentState !== 'PENDING_REVIEW') {
      setActiveCheckout(null);
      setCheckoutAttemptCounter((c) => c + 1);
    }

    setLastUpdatedProductId(product.id);
    setCartPulse(true);
    window.setTimeout(() => setCartPulse(false), 260);
  }

  function handleAdvanceFromStep1() {
    if (cartSummary.totalItems === 0) return;
    setErrorMsg(null);
    // Regla del Paso 2: Si el usuario ya inició sesión, omitimos el paso de identificación y avanzamos directo al pago (Paso 3)
    if (customer) {
      setCurrentStep(3);
    } else {
      setCurrentStep(2);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBackToStep(targetStep: ExpressStep) {
    setErrorMsg(null);
    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSaveDraftForLater(stepToSave: number = currentStep) {
    if (cartSummary.lines.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_DRAFT',
          savedStep: Math.min(3, Math.max(1, stepToSave)),
          customerDisplayName: customer?.fullName || quickName || undefined,
          items: cartSummary.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'No se pudo guardar el borrador.');
        return;
      }
      setDraftSavedBanner({
        canRecoverAcrossDevices: Boolean(data.draft?.canRecoverAcrossDevices),
        expiresAt: data.draft?.expiresAt,
      });
      await loadCatalogAndSession();
    } catch {
      setErrorMsg('No se pudo guardar el borrador en este momento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecoverSavedDraft() {
    if (!savedDraft) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECOVER_DRAFT',
          draftId: savedDraft.draftId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.draft) {
        setErrorMsg(data.message || 'El borrador ya no se encuentra disponible.');
        setSavedDraft(null);
        return;
      }

      const recovered: RecoveredDraftData = data.draft;
      const nextCart: Record<string, number> = {};
      for (const item of recovered.validatedItems) {
        if (item.quantity > 0) {
          nextCart[item.productId] = item.quantity;
        }
      }
      setCart(nextCart);

      if (recovered.notices && recovered.notices.length > 0) {
        setRevalidationNotices(recovered.notices.map((n) => n.message));
      } else {
        setRevalidationNotices([]);
      }

      await loadCatalogAndSession();

      if (Object.keys(nextCart).length > 0) {
        if (customer) {
          setCurrentStep(3);
        } else if (recovered.savedStep >= 2) {
          setCurrentStep(2);
        } else {
          setCurrentStep(1);
        }
      }
    } catch {
      setErrorMsg('Error al recuperar tu borrador guardado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDiscardSavedDraft() {
    if (!savedDraft) return;
    const draftIdToDiscard = savedDraft.draftId;
    setSavedDraft(null);
    await fetch(`/api/v1/tenants/${slug}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DISCARD_DRAFT',
        draftId: draftIdToDiscard,
      }),
    }).catch(() => undefined);
  }

  async function handleContinueWithGoogle() {
    if (cartSummary.lines.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Guardamos el borrador en el servidor antes de salir a Google para que al regresar se vincule automáticamente
      await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE_DRAFT',
          savedStep: 3,
          items: cartSummary.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
        }),
      }).catch(() => undefined);

      window.location.href = `/api/auth/google/start?slug=${encodeURIComponent(
        slug
      )}&step=3`;
    } catch {
      setSubmitting(false);
      setErrorMsg('No se pudo iniciar la redirección a Google.');
    }
  }

  async function handleQuickSessionIdentification(e: React.FormEvent) {
    e.preventDefault();
    if (!quickName.trim() || quickName.trim().length < 2) {
      setErrorMsg('Ingresá tu nombre o apodo para vincular tu pedido.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IDENTIFY_SESSION',
          displayName: quickName.trim(),
          emailOrContact: quickContact.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'No se pudo vincular tu sesión.');
        return;
      }
      setCustomer(data.customer);
      setShowQuickIdentifyForm(false);
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMsg('Error de conexión al identificar tu sesión.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInitiateMercadoPagoPayment() {
    if (cartSummary.lines.length === 0 || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    setRevalidationNotices([]);

    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': currentIdempotencyKey,
        },
        body: JSON.stringify({
          action: 'CREATE_CHECKOUT',
          idempotencyKey: currentIdempotencyKey,
          customerDisplayName:
            customer?.fullName || quickName.trim() || 'Invitado Club',
          guestRecoveryContact:
            customer?.email || quickContact.trim() || undefined,
          draftId: savedDraft?.draftId,
          items: cartSummary.lines.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
            expectedUnitPriceCents: l.product.effective_price_cents,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Si cambió un precio o se agotó stock justo antes de pagar, recargamos la carta real y avisamos con claridad
        await loadCatalogAndSession();
        setCheckoutAttemptCounter((c) => c + 1);
        setErrorMsg(
          data.message ||
            'Actualizamos la disponibilidad o los precios de la carta. Revisá tu resumen antes de pagar.'
        );
        return;
      }

      setActiveCheckout({
        orderId: data.checkout.orderId,
        orderNumber: data.checkout.orderNumber,
        subtotalCents: data.checkout.subtotalCents,
        discountCents: data.checkout.discountCents,
        totalCents: data.checkout.totalCents,
        reservationExpiresAt: data.checkout.reservationExpiresAt,
        preferenceId: data.mpPreference.preferenceId,
        initPointUrl: data.mpPreference.initPointUrl,
        paymentState: 'REDIRECTED_MP',
      });
      setSavedDraft(null);
      await loadCatalogAndSession();
    } catch {
      setErrorMsg('No pudimos iniciar el cobro. Verificá tu conexión e intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyPaymentOutcome(
    outcomeAction:
      | 'CONFIRM_PAYMENT'
      | 'MARK_PAYMENT_PENDING'
      | 'MARK_PAYMENT_REJECTED'
  ) {
    if (!activeCheckout || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/tenants/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: outcomeAction,
          orderId: activeCheckout.orderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(
          data.message || 'No se pudo verificar el estado del pago.'
        );
        return;
      }

      if (outcomeAction === 'CONFIRM_PAYMENT' && data.order) {
        setConfirmedOrder(data.order);
        setActiveCheckout(null);
        setCart({});
        window.sessionStorage.removeItem(localCartKey);
        setCurrentStep(4);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await loadCatalogAndSession();
        return;
      }

      if (outcomeAction === 'MARK_PAYMENT_PENDING') {
        setActiveCheckout((prev) =>
          prev ? { ...prev, paymentState: 'PENDING_REVIEW' } : null
        );
        await loadCatalogAndSession();
        return;
      }

      if (outcomeAction === 'MARK_PAYMENT_REJECTED') {
        setActiveCheckout((prev) =>
          prev ? { ...prev, paymentState: 'REJECTED' } : null
        );
        await loadCatalogAndSession();
      }
    } catch {
      setErrorMsg('Error de conexión al verificar el pago.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetryAfterRejectedPayment() {
    setErrorMsg(null);
    setActiveCheckout(null);
    setCheckoutAttemptCounter((c) => c + 1);
  }

  async function verifyOrderFromBackend(orderIdToVerify: string) {
    setRefreshingOrderStatus(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/v1/tenants/${slug}/checkout?orderId=${encodeURIComponent(
          orderIdToVerify
        )}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok || !data.order) {
        setErrorMsg(data.message || 'No se pudo consultar el pedido.');
        return;
      }

      const verifiedOrder: AuthorizedOrderView = data.order;
      if (verifiedOrder.paymentStatus === 'APPROVED' && verifiedOrder.qr) {
        setConfirmedOrder(verifiedOrder);
        setCurrentStep(4);
      } else if (
        verifiedOrder.paymentStatus === 'IN_REVIEW' ||
        verifiedOrder.paymentStatus === 'AWAITING_WEBHOOK'
      ) {
        setActiveCheckout({
          orderId: verifiedOrder.orderId,
          orderNumber: verifiedOrder.orderNumber,
          subtotalCents: verifiedOrder.subtotalCents,
          discountCents: verifiedOrder.discountCents,
          totalCents: verifiedOrder.totalCents,
          reservationExpiresAt:
            verifiedOrder.reservationExpiresAt || new Date().toISOString(),
          preferenceId: '',
          initPointUrl: '',
          paymentState: 'PENDING_REVIEW',
        });
        setCurrentStep(3);
      } else if (verifiedOrder.paymentStatus === 'REJECTED') {
        setActiveCheckout({
          orderId: verifiedOrder.orderId,
          orderNumber: verifiedOrder.orderNumber,
          subtotalCents: verifiedOrder.subtotalCents,
          discountCents: verifiedOrder.discountCents,
          totalCents: verifiedOrder.totalCents,
          reservationExpiresAt:
            verifiedOrder.reservationExpiresAt || new Date().toISOString(),
          preferenceId: '',
          initPointUrl: '',
          paymentState: 'REJECTED',
        });
        setCurrentStep(3);
      }
    } catch {
      setErrorMsg('No se pudo verificar el estado actualizado del pedido.');
    } finally {
      setRefreshingOrderStatus(false);
    }
  }

  async function handleDownloadPassImage() {
    if (!qrDataUrl || !confirmedOrder?.qr || !tenant) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 960;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fondo nocturno profundo de alto contraste
      ctx.fillStyle = '#070709';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Borde luminoso superior
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, canvas.width, 14);

      // Nombre del establecimiento
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 34px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tenant.fantasy_name.toUpperCase(), canvas.width / 2, 85);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 20px Inter, system-ui, sans-serif';
      ctx.fillText(
        `Barra Rápida QR • ${tenant.address || tenant.city}`,
        canvas.width / 2,
        122
      );

      // Contenedor blanco puro (#FFFFFF) para el QR
      const boxSize = 460;
      const boxX = (canvas.width - boxSize) / 2;
      const boxY = 165;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxSize, boxSize, 32);
      ctx.fill();

      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error('QR load error'));
        qrImg.src = qrDataUrl;
      });

      ctx.drawImage(qrImg, boxX + 30, boxY + 30, boxSize - 60, boxSize - 60);

      // Código corto y número de pedido
      ctx.fillStyle = '#94A3B8';
      ctx.font = '700 18px Inter, system-ui, sans-serif';
      ctx.fillText('CÓDIGO DE VERIFICACIÓN EN BARRA', canvas.width / 2, 685);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 54px monospace';
      ctx.fillText(confirmedOrder.qr.qrShortCode, canvas.width / 2, 748);

      ctx.fillStyle = '#00F0FF';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText(
        `Pedido #${confirmedOrder.orderNumber} • ${formatArsFromCents(
          confirmedOrder.totalCents
        )}`,
        canvas.width / 2,
        805
      );

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 20px Inter, system-ui, sans-serif';
      ctx.fillText(
        'Mostrá este QR en la barra para retirar tu pedido',
        canvas.width / 2,
        865
      );

      const finalPngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = finalPngUrl;
      link.download = `QR-${confirmedOrder.orderNumber}.png`;
      link.click();
    } catch {
      // Fallback directo al dataUrl del QR
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `QR-${confirmedOrder.orderNumber}.png`;
      link.click();
    }
  }

  function handleStartNewOrder() {
    setConfirmedOrder(null);
    setActiveCheckout(null);
    setCart({});
    setErrorMsg(null);
    setCheckoutAttemptCounter((c) => c + 1);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading && !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040407] p-6 text-slate-200">
        <div className="bo-glass-pill flex items-center gap-3.5 rounded-2xl px-6 py-4 text-sm font-black tracking-wide text-white">
          <span className="h-3 w-3 animate-ping rounded-full bg-[#FF2E63]" />
          Abriendo BarraOnline Express...
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#040407] p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <h1 className="text-2xl font-black text-white">
          Establecimiento no disponible
        </h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/15"
        >
          Reintentar conexión
        </button>
      </div>
    );
  }

  const confirmedOrdersWithQr = recentOrders.filter(
    (o) => o.paymentStatus === 'APPROVED' && o.qr
  );

  return (
    <div
      style={
        {
          '--bo-accent-primary': accent,
          '--bo-accent-secondary': accentSecondary,
          '--bo-accent-on-primary': accentText,
        } as React.CSSProperties
      }
      className="relative min-h-screen bg-[#040407] pb-36 text-slate-100 lg:pb-16"
    >
      {/* Iluminación Ambiental Nocturna del Establecimiento */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="bo-stage-grid absolute inset-0 opacity-60" />
        <div
          className="animate-bo-pulse-glow absolute -top-32 left-1/2 h-[26rem] w-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: accent }}
        />
        <div
          className="absolute top-1/3 -right-32 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ backgroundColor: accentSecondary }}
        />
      </div>

      {/* ======================================================================
          HEADER COMPACTO + INDICADOR VISUAL DE PROGRESO DE 4 PASOS
          ====================================================================== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#05060C]/90 backdrop-blur-2xl">
        <div className="mx-auto max-w-5xl px-4 pt-3 pb-2.5">
          {/* Fila Superior: Identidad del Boliche + Acceso Rápido a QRs / Cuenta */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {currentStep > 1 && currentStep < 4 ? (
                <button
                  type="button"
                  onClick={() =>
                    handleBackToStep(
                      currentStep === 3 && customer ? 1 : ((currentStep - 1) as ExpressStep)
                    )
                  }
                  aria-label="Volver al paso anterior"
                  className="bo-gpu-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white hover:border-white/30"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleBackToStep(1)}
                  aria-label={`Inicio de ${tenant.fantasy_name}`}
                  className="bo-gpu-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 hover:border-white/30 hover:text-white"
                >
                  <GlassWater className="h-4 w-4" style={{ color: accent }} />
                </button>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-base font-black tracking-tight text-white sm:text-lg">
                    {tenant.fantasy_name}
                  </h1>
                  <span
                    style={{
                      backgroundColor: `${accent}22`,
                      color: accent,
                      borderColor: `${accent}50`,
                    }}
                    className="hidden rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase sm:inline-block"
                  >
                    EXPRESS
                  </span>
                </div>
                <p className="truncate text-[11px] font-medium text-slate-400">
                  {tenant.city} • Retiro rápido en barra con QR
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {customer && (
                <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] pl-3 pr-1.5 py-1 text-xs font-bold text-slate-200">
                  <UserCheck className="h-3.5 w-3.5" style={{ color: accentSecondary }} />
                  <span className="max-w-[7rem] truncate">{customer.fullName}</span>
                  <button
                    type="button"
                    onClick={() => setShowLogoutModal(true)}
                    title="Cerrar sesión en este boliche"
                    aria-label="Cerrar sesión en este boliche"
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors ml-1"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
              )}

              {(confirmedOrdersWithQr.length > 0 || savedDraft) && (
                <button
                  type="button"
                  onClick={() => setShowMyOrdersDrawer(true)}
                  className="bo-gpu-transition inline-flex items-center gap-1.5 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/12 px-3 py-2 text-xs font-black text-[#00F0FF] uppercase hover:bg-[#00F0FF]/20"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>
                    {confirmedOrdersWithQr.length > 0
                      ? `Mi QR (${confirmedOrdersWithQr.length})`
                      : 'Mi borrador'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Indicador de Progreso Nocturno de 4 Pasos */}
          <nav
            aria-label="Progreso de tu pedido"
            className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2"
          >
            {EXPRESS_STEPS.map((item) => {
              const isCompleted = currentStep > item.step;
              const isCurrent = currentStep === item.step;
              const canJumpBack =
                item.step < currentStep &&
                currentStep !== 4 &&
                !(item.step === 2 && customer);

              return (
                <button
                  key={item.step}
                  type="button"
                  disabled={!canJumpBack}
                  onClick={() => canJumpBack && handleBackToStep(item.step)}
                  className={`group relative flex flex-col gap-1.5 rounded-xl px-2.5 py-2 text-left transition-all duration-300 ${
                    isCurrent
                      ? 'border border-white/20 bg-white/[0.07] shadow-[0_8px_20px_rgba(0,0,0,0.45)]'
                      : isCompleted
                        ? 'border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]'
                        : 'border border-white/5 bg-white/[0.02] opacity-55'
                  } ${canJumpBack ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      style={
                        isCurrent
                          ? { color: accent }
                          : isCompleted
                            ? { color: '#34D399' }
                            : undefined
                      }
                      className="font-mono text-[10px] font-black tracking-wider uppercase text-slate-400"
                    >
                      Paso {item.step}
                    </span>
                    {isCompleted ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[#070709]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : isCurrent ? (
                      <span
                        style={{ backgroundColor: accent }}
                        className="h-2 w-2 animate-pulse rounded-full"
                      />
                    ) : null}
                  </div>

                  <span
                    className={`truncate text-xs font-extrabold ${
                      isCurrent
                        ? 'text-white'
                        : isCompleted
                          ? 'text-emerald-200'
                          : 'text-slate-400'
                    }`}
                  >
                    {item.shortLabel}
                  </span>

                  {/* Barra luminosa inferior del paso */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      style={{
                        width: isCompleted || isCurrent ? '100%' : '0%',
                        backgroundColor: isCompleted ? '#10B981' : accent,
                      }}
                      className="h-full rounded-full transition-all duration-500"
                    />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ======================================================================
          CONTENIDO PRINCIPAL GUIADO (TRANSICIONES FLUIDAS SIN RECARGA)
          ====================================================================== */}
      <main className="relative z-10 mx-auto max-w-5xl px-4 pt-4">
        {/* Alertas de validación o cambios de precio/stock */}
        {errorMsg && (
          <div
            role="alert"
            className="animate-bo-step-enter mb-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/45 bg-rose-950/60 p-4 text-xs font-semibold text-rose-100 backdrop-blur-xl"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="rounded-lg p-1 text-rose-300 hover:bg-white/10"
              aria-label="Cerrar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {revalidationNotices.length > 0 && (
          <div
            role="status"
            className="animate-bo-step-enter mb-4 rounded-2xl border border-amber-400/40 bg-amber-950/50 p-4 text-xs text-amber-100 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 font-black uppercase text-amber-300">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Actualización de carta al recuperar tu borrador
              </span>
              <button
                type="button"
                onClick={() => setRevalidationNotices([])}
                className="text-[11px] underline"
              >
                Entendido
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-amber-100/90">
              {revalidationNotices.map((notice, idx) => (
                <li key={idx}>• {notice}</li>
              ))}
            </ul>
          </div>
        )}

        {draftSavedBanner && (
          <div
            role="status"
            className="animate-bo-step-enter mb-4 rounded-2xl border border-[#00F0FF]/45 bg-[#0A1926]/90 p-4 text-xs text-slate-100 shadow-lg backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-black text-[#00F0FF] uppercase">
                  <Bookmark className="h-4 w-4" />
                  Borrador guardado para continuar después
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {draftSavedBanner.canRecoverAcrossDevices
                    ? 'Tus bebidas seleccionadas quedaron vinculadas a tu cuenta. Podés retomar el pedido cuando quieras desde este o cualquier otro dispositivo.'
                    : 'Tus bebidas quedaron guardadas en este navegador. No se generó ningún cobro ni reserva definitiva. Si querés abrirlo desde otro teléfono, identificate con tu cuenta.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDraftSavedBanner(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ====================================================================
            PASO 1 — ELEGÍ TUS TRAGOS
            ==================================================================== */}
        {currentStep === 1 && (
          <div className="animate-bo-step-enter grid gap-6 lg:grid-cols-12 lg:items-start">
            {/* Columna Principal de Selección Rápida (8 columnas en desktop) */}
            <div className="space-y-4 lg:col-span-8">
              {/* Tarjeta para retomar borrador guardado si existe y el carrito está vacío */}
              {savedDraft &&
                savedDraft.validatedItems.length > 0 &&
                cartSummary.totalItems === 0 && (
                  <div className="bo-glass-panel rounded-3xl border border-[#00F0FF]/40 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#00F0FF] uppercase">
                          <History className="h-3.5 w-3.5" />
                          Tenés un pedido guardado sin pagar
                        </div>
                        <p className="text-sm font-extrabold text-white">
                          {savedDraft.validatedItems.reduce(
                            (acc, i) => acc + i.quantity,
                            0
                          )}{' '}
                          productos •{' '}
                          {formatArsFromCents(savedDraft.currentTotalCents)}
                        </p>
                        {savedDraft.hasChanges && (
                          <p className="text-[11px] text-amber-300">
                            Actualizamos precios o disponibilidad según la carta vigente.
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleDiscardSavedDraft}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white"
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={handleRecoverSavedDraft}
                          className="bo-btn-laser rounded-xl bg-[#00F0FF] px-4 py-2 text-xs font-black text-[#070709] uppercase shadow-md"
                        >
                          Retomar pedido
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Encabezado del Paso 1 */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                    Elegí tus tragos
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tocá para sumar bebidas y avanzá al instante.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-slate-400">
                  +18 Ley 24.788
                </span>
              </div>

              {/* Categorías Horizontales Compactas (Priorizando Destacados del Boliche) */}
              <nav
                aria-label="Categorías de la carta"
                className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar"
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('FEATURED')}
                  style={
                    selectedCategoryId === 'FEATURED'
                      ? {
                          backgroundColor: accent,
                          color: accentText,
                          boxShadow: `0 0 22px ${accent}55`,
                        }
                      : undefined
                  }
                  className={`bo-gpu-transition flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black tracking-wide uppercase ${
                    selectedCategoryId === 'FEATURED'
                      ? 'shadow-lg'
                      : 'border border-white/10 bg-[#10131E]/90 text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" />
                  <span>Destacados</span>
                </button>

                {categories.map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      style={
                        active
                          ? {
                              backgroundColor: accent,
                              color: accentText,
                              boxShadow: `0 0 22px ${accent}55`,
                            }
                          : undefined
                      }
                      className={`bo-gpu-transition flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-black tracking-wide uppercase ${
                        active
                          ? 'shadow-lg'
                          : 'border border-white/10 bg-[#10131E]/90 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span>{cat.name}</span>
                      {cat.badge_text && !active && (
                        <span
                          style={{ color: accent }}
                          className="rounded-full bg-white/5 px-1.5 py-0.2 text-[9px] font-black"
                        >
                          •
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('ALL')}
                  style={
                    selectedCategoryId === 'ALL'
                      ? {
                          backgroundColor: accent,
                          color: accentText,
                          boxShadow: `0 0 22px ${accent}55`,
                        }
                      : undefined
                  }
                  className={`bo-gpu-transition shrink-0 rounded-2xl px-4 py-2.5 text-xs font-black tracking-wide uppercase ${
                    selectedCategoryId === 'ALL'
                      ? 'shadow-lg'
                      : 'border border-white/10 bg-[#10131E]/90 text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                >
                  Toda la carta
                </button>
              </nav>

              {/* Lista de Selección Rápida a Una Mano */}
              <div className="space-y-2.5">
                {displayedProducts.map((product) => {
                  const qtyInCart = cart[product.id] ?? 0;
                  const hasPromo = product.promo_price_cents !== null;
                  const isOutOfStock =
                    !product.in_stock || product.available_stock <= 0;
                  const isAtMaxLimit =
                    qtyInCart >=
                    Math.min(product.max_per_order, product.available_stock);
                  const isLowStock =
                    !isOutOfStock && product.available_stock <= 5;
                  const wasJustUpdated = lastUpdatedProductId === product.id;

                  return (
                    <div
                      key={product.id}
                      style={
                        qtyInCart > 0
                          ? {
                              borderColor: `${accent}90`,
                              boxShadow: `0 12px 32px -12px ${accent}38`,
                            }
                          : undefined
                      }
                      className={`relative flex items-center justify-between gap-3.5 rounded-3xl border p-4 transition-all duration-200 ${
                        qtyInCart > 0
                          ? 'bg-gradient-to-r from-[#171B29]/95 to-[#10131E]/95'
                          : 'border-white/10 bg-[#0D1019]/90 hover:border-white/20'
                      } ${isOutOfStock ? 'opacity-55' : ''}`}
                    >
                      {/* Imagen real del producto cuando exista */}
                      {product.image_url && (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}

                      {/* Información esencial para decidir en segundos */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {product.promo_label && (
                            <span
                              style={{
                                backgroundColor: accent,
                                color: accentText,
                              }}
                              className="rounded-lg px-2 py-0.5 text-[10px] font-black tracking-wider uppercase"
                            >
                              {product.promo_label}
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-slate-400">
                            {product.category_name}
                          </span>
                          {isOutOfStock ? (
                            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-300 uppercase">
                              Agotado
                            </span>
                          ) : isLowStock ? (
                            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              Últimas {product.available_stock}
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-400">
                              • Disponible
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-black text-white leading-snug">
                          {product.name}
                        </h3>

                        {product.description && (
                          <p className="line-clamp-1 text-xs text-slate-400">
                            {product.description}
                          </p>
                        )}

                        <div className="flex items-baseline gap-2 pt-0.5">
                          <span className="tabular-nums text-lg font-black text-white">
                            {formatArsFromCents(product.effective_price_cents)}
                          </span>
                          {hasPromo && (
                            <span className="tabular-nums text-xs text-slate-500 line-through">
                              {formatArsFromCents(product.price_cents)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Control directo de cantidad sobre el producto (Zona del pulgar) */}
                      <div className="shrink-0">
                        {isOutOfStock ? (
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-slate-500 uppercase"
                          >
                            Sin stock
                          </button>
                        ) : qtyInCart === 0 ? (
                          <button
                            type="button"
                            aria-label={`Agregar ${product.name}`}
                            onClick={() => updateQuantity(product, 1)}
                            style={{
                              backgroundColor: `${accent}20`,
                              color: '#FFFFFF',
                              borderColor: `${accent}66`,
                            }}
                            className="bo-gpu-transition flex h-12 items-center gap-1.5 rounded-2xl border px-4 text-xs font-black uppercase hover:brightness-110 active:scale-95"
                          >
                            <Plus
                              className="h-4 w-4 stroke-[2.75]"
                              style={{ color: accent }}
                            />
                            <span>Agregar</span>
                          </button>
                        ) : (
                          <div
                            className={`flex items-center gap-1.5 rounded-2xl border border-white/15 bg-[#090B12] p-1 shadow-inner ${
                              wasJustUpdated ? 'animate-bo-qty-pop' : ''
                            }`}
                          >
                            <button
                              type="button"
                              aria-label={`Restar unidad de ${product.name}`}
                              onClick={() => updateQuantity(product, -1)}
                              className="bo-gpu-transition flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                            >
                              <Minus className="h-4 w-4" />
                            </button>

                            <span className="tabular-nums min-w-[1.75rem] text-center text-base font-black text-white">
                              {qtyInCart}
                            </span>

                            <button
                              type="button"
                              disabled={isAtMaxLimit}
                              aria-label={`Sumar unidad de ${product.name}`}
                              onClick={() => updateQuantity(product, 1)}
                              style={{
                                backgroundColor: accent,
                                color: accentText,
                              }}
                              className="bo-gpu-transition flex h-10 w-10 items-center justify-center rounded-xl font-black shadow-md disabled:opacity-35"
                            >
                              <Plus className="h-4 w-4 stroke-[2.75]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Panel Lateral Compacto de Resumen en Escritorio (lg:col-span-4) */}
            <aside className="hidden lg:col-span-4 lg:block">
              <div className="bo-glass-panel sticky top-32 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <GlassWater
                      className="h-4 w-4"
                      style={{ color: accent }}
                    />
                    <span className="text-xs font-black tracking-wider text-white uppercase">
                      Tu pedido en vivo
                    </span>
                  </div>
                  {cartSummary.totalItems > 0 && (
                    <span
                      className={`rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-black text-white transition-transform ${
                        cartPulse ? 'scale-110' : ''
                      }`}
                    >
                      {cartSummary.totalItems}{' '}
                      {cartSummary.totalItems === 1 ? 'unidad' : 'unidades'}
                    </span>
                  )}
                </div>

                {cartSummary.lines.length === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <p className="text-sm font-bold text-slate-300">
                      Todavía no elegiste tus tragos
                    </p>
                    <p className="text-xs text-slate-500">
                      Tocá «+ Agregar» sobre cualquier bebida de la carta para
                      armar tu pedido.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                      {cartSummary.lines.map((line) => (
                        <div
                          key={line.product.id}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/35 px-3 py-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-white">
                              {line.quantity}x {line.product.name}
                            </div>
                            <div className="tabular-nums text-[11px] text-slate-400">
                              {formatArsFromCents(line.lineTotalCents)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.product, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                              aria-label={`Quitar ${line.product.name}`}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                line.quantity >=
                                Math.min(
                                  line.product.max_per_order,
                                  line.product.available_stock
                                )
                              }
                              onClick={() => updateQuantity(line.product, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-35"
                              aria-label={`Sumar ${line.product.name}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 border-t border-white/10 pt-3 text-xs">
                      {cartSummary.discountCents > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Ahorro promocional</span>
                          <span className="tabular-nums font-bold">
                            - {formatArsFromCents(cartSummary.discountCents)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-sm font-bold text-slate-300">
                          Total
                        </span>
                        <span className="tabular-nums text-2xl font-black text-white">
                          {formatArsFromCents(cartSummary.totalCents)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  disabled={cartSummary.totalItems === 0}
                  onClick={handleAdvanceFromStep1}
                  style={
                    cartSummary.totalItems > 0
                      ? {
                          backgroundColor: accent,
                          color: accentText,
                          boxShadow: `0 0 28px ${accent}66`,
                        }
                      : undefined
                  }
                  className="bo-btn-laser flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black tracking-wide uppercase disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none"
                >
                  <span>
                    {cartSummary.totalItems > 0
                      ? 'Continuar'
                      : 'Elegí un trago para continuar'}
                  </span>
                  {cartSummary.totalItems > 0 && (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </button>

                {cartSummary.totalItems > 0 && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSaveDraftForLater(1)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-slate-400 hover:text-white transition"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Guardar y continuar después
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* ====================================================================
            PASO 2 — IDENTIFICATE SIN FRICCIÓN
            ==================================================================== */}
        {currentStep === 2 && (
          <div className="animate-bo-step-enter mx-auto max-w-lg space-y-5 pt-2">
            {/* Resumen compacto de lo elegido en el Paso 1 */}
            <div className="bo-glass-pill flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-400 uppercase">
                  Tu selección en {tenant.fantasy_name}
                </div>
                <div className="truncate text-sm font-black text-white">
                  {cartSummary.totalItems}{' '}
                  {cartSummary.totalItems === 1 ? 'producto' : 'productos'} ·{' '}
                  <span className="tabular-nums text-[#00F0FF]">
                    {formatArsFromCents(cartSummary.totalCents)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleBackToStep(1)}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
            </div>

            {/* Pantalla de Identificación Minimalista */}
            <section className="bo-glass-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-8 space-y-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
                style={{ backgroundColor: accent }}
              />

              <div className="relative z-10 space-y-2 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black tracking-wider text-[#00F0FF] uppercase">
                  <Sparkles className="h-3.5 w-3.5" />
                  Paso 2 de 4 • Acceso inmediato
                </span>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Identificate en un toque
                </h2>
                <p className="text-sm font-medium text-slate-300">
                  Así podés recuperar tu pedido y tu QR si lo necesitás.
                </p>
              </div>

              {/* Acción Principal: Continuar con Google */}
              <div className="relative z-10 space-y-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleContinueWithGoogle}
                  className="bo-btn-laser flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-black text-[#070709] shadow-[0_0_35px_rgba(255,255,255,0.25)] transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.2 14.7 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </button>

                {/* Si el entorno no tiene GOOGLE_CLIENT_ID configurado o el usuario prefiere sesión rápida del sistema */}
                {!googleOAuthConfigured && (
                  <p className="text-center text-[11px] text-amber-300/90">
                    En este entorno local no se configuraron credenciales OAuth de
                    Google (`GOOGLE_CLIENT_ID`). Podés continuar al instante
                    identificando tu sesión aquí abajo:
                  </p>
                )}

                {!showQuickIdentifyForm && googleOAuthConfigured ? (
                  <button
                    type="button"
                    onClick={() => setShowQuickIdentifyForm(true)}
                    className="w-full rounded-xl border border-white/12 bg-white/[0.04] py-3 text-xs font-bold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
                  >
                    Continuar con sesión rápida en este navegador
                  </button>
                ) : (
                  <form
                    onSubmit={handleQuickSessionIdentification}
                    className="rounded-2xl border border-white/12 bg-black/45 p-4 space-y-3"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="express-customer-name"
                        className="block text-[11px] font-bold text-slate-300 uppercase"
                      >
                        Tu nombre o apodo para retirar en barra
                      </label>
                      <input
                        id="express-customer-name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={80}
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="Ej: Valentina"
                        className="w-full rounded-xl border border-white/15 bg-[#090B12] px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="express-customer-contact"
                        className="block text-[11px] font-bold text-slate-400"
                      >
                        Email (opcional, para asociar tu pedido)
                      </label>
                      <input
                        id="express-customer-contact"
                        type="text"
                        maxLength={120}
                        value={quickContact}
                        onChange={(e) => setQuickContact(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full rounded-xl border border-white/10 bg-[#090B12] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      style={{
                        backgroundColor: accent,
                        color: accentText,
                      }}
                      className="bo-btn-laser flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-xs font-black tracking-wider uppercase shadow-lg disabled:opacity-50"
                    >
                      <span>Continuar al pago</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                )}
              </div>

              {/* Acción Secundaria: Guardar y continuar después */}
              <div className="relative z-10 border-t border-white/10 pt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => handleBackToStep(1)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver a los tragos
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveDraftForLater(2)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/[0.08]"
                >
                  <Bookmark className="h-3.5 w-3.5 text-[#00F0FF]" />
                  Guardar y continuar después
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ====================================================================
            PASO 3 — PAGÁ EN SEGUNDOS
            ==================================================================== */}
        {currentStep === 3 && (
          <div className="animate-bo-step-enter mx-auto max-w-lg space-y-5 pt-2">
            <section className="bo-glass-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-7 space-y-5">
              {/* Cabecera del Paso 3 */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#00F0FF] uppercase">
                    <CreditCard className="h-3.5 w-3.5" />
                    Paso 3 de 4 • Pago directo y seguro
                  </span>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                    Confirmá y pagá
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => handleBackToStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar pedido
                </button>
              </div>

              {/* Identidad vinculada al pedido */}
              {customer && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-slate-300">
                      Pedido a nombre de{' '}
                      <strong className="text-white">{customer.fullName}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">
                    {customer.provider === 'GOOGLE' ? 'Google ✓' : 'Sesión activa'}
                  </span>
                </div>
              )}

              {/* Resumen compacto de productos, cantidades e importes */}
              <div className="space-y-2">
                <div className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
                  Resumen de tus bebidas
                </div>
                <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-black/40 px-4 py-1">
                  {cartSummary.lines.map((line) => (
                    <div
                      key={line.product.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-black text-white">
                          {line.quantity}x
                        </span>{' '}
                        <span className="font-bold text-slate-100">
                          {line.product.name}
                        </span>
                        <div className="text-[11px] text-slate-400">
                          {formatArsFromCents(line.product.effective_price_cents)}{' '}
                          c/u
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums font-black text-white">
                          {formatArsFromCents(line.lineTotalCents)}
                        </div>
                        {line.lineDiscountCents > 0 && (
                          <div className="tabular-nums text-[10px] text-slate-500 line-through">
                            {formatArsFromCents(line.lineRegularCents)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desglose de descuentos e Importe Final destacado */}
              <div className="rounded-2xl border border-white/12 bg-[#090C15] p-4 space-y-2">
                {cartSummary.discountCents > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Subtotal regular</span>
                      <span className="tabular-nums">
                        {formatArsFromCents(cartSummary.regularSubtotalCents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-400">
                      <span>Descuento promo vigente</span>
                      <span className="tabular-nums">
                        - {formatArsFromCents(cartSummary.discountCents)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-extrabold text-slate-200 uppercase">
                    Importe final
                  </span>
                  <span className="tabular-nums text-3xl font-black text-white">
                    {formatArsFromCents(
                      activeCheckout?.totalCents ?? cartSummary.totalCents
                    )}
                  </span>
                </div>
              </div>

              {/* Medio de pago disponible: Mercado Pago del Establecimiento */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#009EE3]/35 bg-[#009EE3]/10 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#009EE3] font-black text-white shadow-md">
                    MP
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">
                      Mercado Pago • Checkout Oficial
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Dinero en cuenta, débito o crédito directo en{' '}
                      {tenant.fantasy_name}
                    </div>
                  </div>
                </div>
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#00F0FF]" />
              </div>

              {/* ESTADOS DE PAGO:
                  1. Sin orden iniciada aún -> Botón inequívoco "Pagar $XX.XXX"
                  2. Orden reservada y dirigida a Mercado Pago -> Confirmación verificada
                  3. Pago Pendiente -> Aviso claro sin emitir QR
                  4. Pago Rechazado -> Aviso claro + botón Reintentar sin perder selección
               */}
              {!activeCheckout && (
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    disabled={submitting || cartSummary.totalItems === 0}
                    onClick={handleInitiateMercadoPagoPayment}
                    style={{
                      backgroundColor: accent,
                      color: accentText,
                      boxShadow: `0 0 32px ${accent}66`,
                    }}
                    className="bo-btn-laser flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-black tracking-wide uppercase disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Validando stock y preparando pago...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          Pagar {formatArsFromCents(cartSummary.totalCents)}
                        </span>
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleBackToStep(1)}
                      className="text-xs font-bold text-slate-400 hover:text-white"
                    >
                      ← Volver y editar pedido
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSaveDraftForLater(3)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#00F0FF] hover:underline"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      Guardar para después
                    </button>
                  </div>
                </div>
              )}

              {activeCheckout &&
                activeCheckout.paymentState === 'REDIRECTED_MP' && (
                  <div className="animate-bo-step-enter rounded-2xl border border-[#009EE3]/50 bg-[#07131F] p-4 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF]/15 px-2.5 py-0.5 text-[10px] font-black text-[#00F0FF] uppercase">
                          <Clock className="h-3 w-3" />
                          Bebidas reservadas hasta{' '}
                          {new Date(
                            activeCheckout.reservationExpiresAt
                          ).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <h3 className="text-sm font-black text-white">
                          Pedido #{activeCheckout.orderNumber} listo para abonar
                        </h3>
                        <p className="text-xs text-slate-300">
                          Completá el pago en Mercado Pago. Al acreditarse, volvés
                          automáticamente a BarraOnline y se activa tu QR de retiro.
                        </p>
                      </div>
                    </div>

                    {activeCheckout.initPointUrl && (
                      <a
                        href={activeCheckout.initPointUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#009EE3]/40 bg-[#009EE3]/15 px-4 py-2.5 text-xs font-bold text-[#7CE2FF] hover:bg-[#009EE3]/25"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Abrir ventana de Mercado Pago Checkout Pro</span>
                      </a>
                    )}

                    <div className="space-y-2 border-t border-white/10 pt-3">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          handleVerifyPaymentOutcome('CONFIRM_PAYMENT')
                        }
                        className="bo-btn-laser flex w-full items-center justify-center gap-2 rounded-2xl bg-[#009EE3] px-5 py-4 text-sm font-black text-white uppercase shadow-[0_0_25px_rgba(0,158,227,0.45)] hover:bg-[#008ED0] disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Verificando pago con el servidor...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span>
                              Pagar {formatArsFromCents(activeCheckout.totalCents)}{' '}
                              con Mercado Pago
                            </span>
                          </>
                        )}
                      </button>

                      {/* Controles de verificación de estados reales de pago (Pendiente / Rechazado) */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            handleVerifyPaymentOutcome('MARK_PAYMENT_PENDING')
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.08]"
                        >
                          Simular pago pendiente
                        </button>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() =>
                            handleVerifyPaymentOutcome('MARK_PAYMENT_REJECTED')
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-white/[0.08]"
                        >
                          Simular pago rechazado
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {activeCheckout &&
                activeCheckout.paymentState === 'PENDING_REVIEW' && (
                  <div className="animate-bo-step-enter rounded-2xl border border-amber-400/50 bg-amber-950/35 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
                      <Clock className="h-4 w-4 shrink-0" />
                      Pago pendiente de confirmación
                    </div>
                    <p className="text-xs leading-relaxed text-amber-100/90">
                      Mercado Pago está procesando tu pago para el pedido{' '}
                      <strong>#{activeCheckout.orderNumber}</strong>. Por
                      seguridad, el código QR de retiro se genera únicamente
                      cuando el pago queda acreditado.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          handleVerifyPaymentOutcome('CONFIRM_PAYMENT')
                        }
                        className="bo-btn-laser flex-1 rounded-xl bg-amber-400 px-4 py-3 text-xs font-black text-[#070709] uppercase"
                      >
                        {submitting
                          ? 'Consultando...'
                          : 'Verificar acreditación ahora'}
                      </button>
                    </div>
                  </div>
                )}

              {activeCheckout && activeCheckout.paymentState === 'REJECTED' && (
                <div className="animate-bo-step-enter rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-300 uppercase">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    No se pudo aprobar el pago
                  </div>
                  <p className="text-xs leading-relaxed text-rose-100/90">
                    El medio de pago rechazó la operación y no se realizó ningún
                    cargo. Conservamos tus bebidas seleccionadas para que puedas
                    reintentar al instante sin armar el pedido de nuevo.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleRetryAfterRejectedPayment}
                      style={{
                        backgroundColor: accent,
                        color: accentText,
                      }}
                      className="bo-btn-laser flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase shadow-lg"
                    >
                      Reintentar pago sin perder mi pedido
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleRetryAfterRejectedPayment();
                        handleBackToStep(1);
                      }}
                      className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-3 text-xs font-bold text-white"
                    >
                      Editar bebidas
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ====================================================================
            PASO 4 — TU QR ESTÁ LISTO (CONFIRMACIÓN Y RETIRO EN BARRA)
            ==================================================================== */}
        {currentStep === 4 && confirmedOrder && confirmedOrder.qr && (
          <div className="animate-bo-qr-celebrate mx-auto max-w-lg space-y-5 pt-1">
            <section
              className={`relative overflow-hidden rounded-[2.25rem] border-2 p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] ${
                confirmedOrder.qr.qrStatus === 'STOCK_CONFLICT'
                  ? 'border-amber-400 bg-gradient-to-b from-amber-950/60 via-[#10131E] to-[#090B12]'
                  : confirmedOrder.fulfillmentStatus === 'DELIVERED' ||
                      confirmedOrder.fulfillmentStatus ===
                        'RESOLVED_WITH_SUBSTITUTE'
                    ? 'border-[#00F0FF] bg-gradient-to-b from-cyan-950/50 via-[#10131E] to-[#090B12]'
                    : 'border-emerald-400 bg-gradient-to-b from-emerald-950/55 via-[#10131E] to-[#090B12]'
              }`}
            >
              {/* Cabecera de Éxito */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400 text-[#070709] shadow-[0_0_35px_rgba(16,185,129,0.55)]">
                  <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-3 py-0.5 text-[11px] font-black tracking-wider text-emerald-300 uppercase">
                  Pedido confirmado • #{confirmedOrder.orderNumber}
                </span>

                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Mostrá este QR en la barra para retirar tu pedido
                </h2>

                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-[#00F0FF]" />
                  <span>
                    {tenant.fantasy_name} • Punto de retiro: Barra Rápida QR
                  </span>
                </div>
              </div>

              {confirmedOrder.qr.qrStatus === 'STOCK_CONFLICT' && (
                <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-3.5 text-xs text-amber-100">
                  <strong>Atención prioritaria en barra:</strong> El pago se
                  acreditó luego del vencimiento de la reserva inicial. Mostrá
                  este QR al barman para recibir una bebida equivalente o el
                  reembolso inmediato del 100%.
                </div>
              )}

              {/* Contenedor QR Puro de Alto Contraste (#FFFFFF) sin filtros ni deformaciones */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="rounded-[2rem] bg-white p-5 shadow-[0_0_50px_rgba(255,255,255,0.22)]">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Código QR de retiro del pedido ${confirmedOrder.orderNumber}`}
                      className="h-60 w-60 object-contain sm:h-64 sm:w-64"
                    />
                  ) : (
                    <div className="flex h-60 w-60 items-center justify-center text-xs font-bold text-black">
                      Generando QR verificado...
                    </div>
                  )}
                </div>

                <div className="mt-4 text-center">
                  <div className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
                    Código de verificación
                  </div>
                  <div className="mt-0.5 font-mono text-3xl font-black tracking-[0.25em] text-white">
                    {confirmedOrder.qr.qrShortCode}
                  </div>
                </div>
              </div>

              {/* Estado Real y Distinguido del Pedido */}
              <div className="rounded-2xl border border-white/12 bg-black/45 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black tracking-wider text-slate-300 uppercase">
                    Estado en vivo del pedido
                  </span>
                  <button
                    type="button"
                    disabled={refreshingOrderStatus}
                    onClick={() =>
                      verifyOrderFromBackend(confirmedOrder.orderId)
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00F0FF] hover:underline disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${
                        refreshingOrderStatus ? 'animate-spin' : ''
                      }`}
                    />
                    Actualizar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {/* 1. Pago confirmado */}
                  <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-black text-emerald-300 uppercase">
                      <Check className="h-3 w-3" />
                      Pago confirmado
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      Acreditado
                    </div>
                  </div>

                  {/* 2. Pedido recibido / En preparación */}
                  <div
                    className={`rounded-xl border p-2.5 ${
                      confirmedOrder.fulfillmentStatus === 'IN_BAR_PREPARATION'
                        ? 'border-[#00F0FF]/50 bg-[#00F0FF]/15 text-white'
                        : 'border-emerald-500/35 bg-emerald-500/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-300">
                      <Check className="h-3 w-3" />
                      {confirmedOrder.fulfillmentStatus === 'IN_BAR_PREPARATION'
                        ? 'En preparación'
                        : 'Pedido recibido'}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      En sistema de barra
                    </div>
                  </div>

                  {/* 3. Disponible para retirar */}
                  <div
                    className={`rounded-xl border p-2.5 ${
                      confirmedOrder.fulfillmentStatus === 'READY_FOR_PICKUP'
                        ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                        : confirmedOrder.fulfillmentStatus === 'DELIVERED' ||
                            confirmedOrder.fulfillmentStatus ===
                              'RESOLVED_WITH_SUBSTITUTE'
                          ? 'border-emerald-500/35 bg-emerald-500/10'
                          : 'border-white/10 bg-white/[0.03] opacity-60'
                    }`}
                  >
                    <div className="text-[10px] font-black text-white uppercase">
                      Disponible p/ retirar
                    </div>
                    <div className="mt-0.5 text-[11px] text-emerald-300">
                      {confirmedOrder.fulfillmentStatus === 'READY_FOR_PICKUP'
                        ? 'Listo en mostrador'
                        : confirmedOrder.fulfillmentStatus === 'DELIVERED' ||
                            confirmedOrder.fulfillmentStatus ===
                              'RESOLVED_WITH_SUBSTITUTE'
                          ? 'Completado'
                          : 'Aguardando barra'}
                    </div>
                  </div>

                  {/* 4. Retirado */}
                  <div
                    className={`rounded-xl border p-2.5 ${
                      confirmedOrder.fulfillmentStatus === 'DELIVERED' ||
                      confirmedOrder.fulfillmentStatus ===
                        'RESOLVED_WITH_SUBSTITUTE'
                        ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-white'
                        : 'border-white/10 bg-white/[0.03] opacity-50'
                    }`}
                  >
                    <div className="text-[10px] font-black uppercase text-white">
                      Retirado
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      {confirmedOrder.fulfillmentStatus === 'DELIVERED' ||
                      confirmedOrder.fulfillmentStatus ===
                        'RESOLVED_WITH_SUBSTITUTE'
                        ? 'Entregado en mano ✓'
                        : 'Pendiente de escaneo'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resumen compacto de lo comprado */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black tracking-wider text-slate-400 uppercase">
                  <span>Detalle de tu compra</span>
                  <span className="tabular-nums text-white">
                    {formatArsFromCents(confirmedOrder.totalCents)}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-slate-200">
                  {confirmedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between"
                    >
                      <span>
                        <strong>{item.quantity}x</strong> {item.productName}
                      </span>
                      <span className="tabular-nums text-slate-400">
                        {formatArsFromCents(item.lineTotalCents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Acciones para Guardar y Consultar el QR */}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDownloadPassImage}
                  className="bo-btn-laser flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-xs font-black text-[#070709] uppercase shadow-lg hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  <span>Guardar QR como imagen</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartNewOrder}
                  className="bo-gpu-transition flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 text-xs font-black text-white uppercase hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" />
                  <span>Pedir otro trago</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ======================================================================
          BARRA INFERIOR PERSISTENTE EN MÓVIL (PASO 1) — RESPETA SAFE AREA
          ====================================================================== */}
      {currentStep === 1 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#080A12]/95 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-2xl shadow-[0_-18px_45px_rgba(0,0,0,0.88)] lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="min-w-0">
              {cartSummary.totalItems > 0 ? (
                <>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <span
                      style={{ backgroundColor: accent }}
                      className={`h-2 w-2 rounded-full transition-transform ${
                        cartPulse ? 'scale-150' : ''
                      }`}
                    />
                    <span className="truncate">
                      {cartSummary.totalItems}{' '}
                      {cartSummary.totalItems === 1 ? 'producto' : 'productos'} ·{' '}
                      <strong className="tabular-nums text-white">
                        {formatArsFromCents(cartSummary.totalCents)}
                      </strong>
                    </span>
                  </div>
                  <div className="tabular-nums text-xl font-black text-white">
                    {formatArsFromCents(cartSummary.totalCents)}
                  </div>
                </>
              ) : (
                <div className="text-xs font-semibold text-slate-400">
                  Elegí al menos un trago de la carta para continuar
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={cartSummary.totalItems === 0}
              onClick={handleAdvanceFromStep1}
              style={
                cartSummary.totalItems > 0
                  ? {
                      backgroundColor: accent,
                      color: accentText,
                      boxShadow: `0 0 28px ${accent}70`,
                    }
                  : undefined
              }
              className="bo-btn-laser flex shrink-0 items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black tracking-wide uppercase disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none"
            >
              <span>Continuar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
          PANEL DESLIZANTE: CONSULTAR MIS QRs ACTIVOS Y BORRADORES GUARDADOS
          ====================================================================== */}
      {showMyOrdersDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mis pedidos y códigos QR"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
        >
          <div className="bo-glass-panel animate-bo-step-enter w-full max-w-md rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-[#00F0FF]" />
                <h3 className="text-base font-black text-white">
                  Mis pedidos y QRs en {tenant.fantasy_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMyOrdersDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {savedDraft && savedDraft.validatedItems.length > 0 && (
              <div className="rounded-2xl border border-[#00F0FF]/35 bg-[#00F0FF]/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-[#00F0FF] uppercase">
                  <span>Borrador guardado</span>
                  <span className="tabular-nums">
                    {formatArsFromCents(savedDraft.currentTotalCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMyOrdersDrawer(false);
                      void handleRecoverSavedDraft();
                    }}
                    className="flex-1 rounded-xl bg-[#00F0FF] py-2 text-xs font-black text-[#070709] uppercase"
                  >
                    Continuar este borrador
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardSavedDraft}
                    aria-label="Descartar borrador"
                    className="rounded-xl border border-white/15 p-2 text-slate-300 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {confirmedOrdersWithQr.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No tenés QRs pendientes de retiro en esta sesión.
              </p>
            ) : (
              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {confirmedOrdersWithQr.map((ord) => (
                  <button
                    key={ord.orderId}
                    type="button"
                    onClick={() => {
                      setConfirmedOrder(ord);
                      setCurrentStep(4);
                      setShowMyOrdersDrawer(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/12 bg-black/45 p-3.5 text-left hover:border-emerald-400/50 transition"
                  >
                    <div>
                      <div className="text-xs font-black text-white">
                        Pedido #{ord.orderNumber}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Código: <strong>{ord.qr?.qrShortCode}</strong> •{' '}
                        {formatArsFromCents(ord.totalCents)}
                      </div>
                    </div>
                    <span className="rounded-xl bg-emerald-400/20 px-2.5 py-1 text-[10px] font-black text-emerald-300 uppercase">
                      Ver QR →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BarraOnlineExpressPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#040407] p-6 text-slate-200">
          <div className="bo-glass-pill flex items-center gap-3.5 rounded-2xl px-6 py-4 text-sm font-black tracking-wide text-white">
            <span className="h-3 w-3 animate-ping rounded-full bg-[#FF2E63]" />
            Abriendo BarraOnline Express...
          </div>
        </div>
      }
    >
      <BarraOnlineExpressContent />
    </Suspense>
  );
}
