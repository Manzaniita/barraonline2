'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  Lock,
  LogOut,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { LogoutModal } from '@/components/auth/LogoutModal';
import { formatArsFromCents, formatDateTimeAr } from '@/lib/format';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  tenantFantasyName: string;
  tenantSlug: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalCents: number;
  createdAt: string;
  hasQr: boolean;
  shortCode: string | null;
}

interface SessionState {
  authenticated: boolean;
  role: 'SUPERADMIN' | 'CUSTOMER' | 'ANONYMOUS';
  user: {
    id?: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string | null;
  } | null;
  orders?: CustomerOrder[];
}

export function LandingHeader() {
  const [session, setSession] = useState<SessionState>({
    authenticated: false,
    role: 'ANONYMOUS',
    user: null,
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.authenticated) {
          setSession(data);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
        <div className="bo-glass-pill mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-4 py-3 sm:px-6">
          <a href="#" className="group flex items-center gap-3">
            <img
              src="/logo-barraonline.png"
              alt="BarraOnline — Pedí • Pagá • Retirá"
              className="h-10 w-auto object-contain drop-shadow-[0_0_16px_rgba(0,229,255,0.35)] transition-transform duration-300 group-hover:scale-105 sm:h-11"
            />
            <span className="hidden rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-[#00F0FF] uppercase lg:inline-block">
              Costa Argentina
            </span>
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-7 text-xs font-extrabold tracking-wider text-slate-300 uppercase md:flex"
          >
            <a
              href="#boliches"
              className="transition-colors hover:text-[#00F0FF]"
            >
              Boliches adheridos
            </a>
            <a
              href="#como-funciona"
              className="transition-colors hover:text-[#FF2E63]"
            >
              Cómo funciona
            </a>
            <a
              href="#ventajas"
              className="transition-colors hover:text-white"
            >
              La experiencia
            </a>
            <a
              href="#para-boliches"
              className="transition-colors hover:text-[#00F0FF]"
            >
              Sumá tu boliche
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Estado autenticado: Superadministrador */}
            {session.authenticated && session.role === 'SUPERADMIN' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-[#00F0FF]/20"
                >
                  <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {session.user?.fullName || 'Superadmin'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/15 bg-[#0C0F17]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-[11px] font-medium text-slate-400">Sesión activa</p>
                      <p className="text-xs font-black text-[#00F0FF] truncate">
                        {session.user?.email}
                      </p>
                      <span className="mt-1 inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00F0FF]">
                        Superadministrador
                      </span>
                    </div>

                    <Link
                      href="/admin"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
                      <span>Panel de control</span>
                    </Link>

                    <Link
                      href="/admin/boliches"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
                    >
                      <Sparkles className="h-4 w-4 text-[#FF2E63]" />
                      <span>Gestión de boliches</span>
                    </Link>

                    <Link
                      href="/admin/cuenta"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-300" />
                      <span>Mi cuenta y seguridad</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => setIsLogoutModalOpen(true)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-400" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Estado autenticado: Cliente */}
            {session.authenticated && session.role === 'CUSTOMER' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-white/10"
                >
                  <UserCheck className="h-4 w-4 text-[#00F0FF]" />
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {session.user?.fullName || 'Mi cuenta'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/15 bg-[#0C0F17]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-[11px] font-medium text-slate-400">Cliente</p>
                      <p className="text-xs font-black text-white truncate">
                        {session.user?.fullName}
                      </p>
                      {session.user?.email && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {session.user.email}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOrdersModalOpen(true)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors text-left"
                    >
                      <QrCode className="h-4 w-4 text-[#00F0FF]" />
                      <span>Mis pedidos y QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLogoutModalOpen(true)}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-400" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}

            {/* Estado no autenticado: Botón Iniciar sesión */}
            {!session.authenticated && (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-black tracking-wider text-slate-200 uppercase transition-all hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 hover:text-white"
              >
                <User className="h-3.5 w-3.5 text-[#00F0FF]" />
                <span>Iniciar sesión</span>
              </button>
            )}

            <a
              href="#boliches"
              className="bo-btn-laser inline-flex items-center gap-2 rounded-xl bg-[#FF2E63] px-4 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_24px_rgba(255,46,99,0.5)]"
            >
              <span>Hacer mi pedido</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Modal de Acceso Unificado (Clientes + Acceso Administrativo discreto) */}
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAuthModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141624] to-[#0A0B12] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)] sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Glows decorativos */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#00F0FF]/15 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[#FF2E63]/15 blur-3xl"
            />

            {/* Botón cerrar */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              aria-label="Cerrar ventana"
              className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 space-y-1.5">
              <span className="inline-block text-[11px] font-black tracking-widest uppercase text-[#00F0FF]">
                Acceso BarraOnline
              </span>
              <h2
                id="auth-modal-title"
                className="text-2xl font-black tracking-tight text-white"
              >
                Iniciar sesión
              </h2>
              <p className="text-xs text-slate-400">
                Elegí cómo querés ingresar a la plataforma.
              </p>
            </div>

            <div className="space-y-4">
              {/* Opción Principal: Acceso Clientes con Google */}
              <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-5 transition-all hover:border-[#00F0FF]/40 hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF]">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">Acceso de Clientes</h3>
                      <p className="text-[11px] text-slate-400">
                        Consultá tu perfil, pedidos y recuperá tus QR
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href="/api/auth/google/start?slug=landing"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-white px-4 py-3 text-xs font-black text-slate-900 transition-all hover:bg-slate-100 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continuar con Google</span>
                </a>
              </div>

              {/* Opción Secundaria y Discreta: Acceso Administrativo */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20 hover:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Acceso Administrativo</h4>
                      <p className="text-[10px] text-slate-400">
                        Superadministrador y gestión de plataforma
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/admin/login"
                    onClick={() => setIsAuthModalOpen(false)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:border-white/30 hover:text-white transition-all"
                  >
                    <span>Ingresar</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pedidos del Cliente ("Mis Pedidos y QRs") */}
      {isOrdersModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOrdersModalOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141624] to-[#0A0B12] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)] sm:p-7 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsOrdersModalOpen(false)}
              aria-label="Cerrar ventana"
              className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <span className="text-[11px] font-black tracking-wider uppercase text-[#00F0FF]">
                Historial de Compras
              </span>
              <h3 className="text-xl font-black text-white">Mis Pedidos y Códigos QR</h3>
              <p className="text-xs text-slate-400">
                Visualizá tus pedidos confirmados para retirar en la barra.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {session.orders && session.orders.length > 0 ? (
                session.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-[#00F0FF]">
                          {order.tenantFantasyName}
                        </span>
                        <h4 className="text-sm font-extrabold text-white">
                          Pedido #{order.orderNumber}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {formatDateTimeAr(order.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-white">
                          {formatArsFromCents(order.totalCents)}
                        </span>
                        <div>
                          <span
                            className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                              order.paymentStatus === 'APPROVED'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {order.paymentStatus === 'APPROVED' ? 'Aprobado' : order.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[11px] text-slate-300">
                        {order.shortCode ? `Código: ${order.shortCode}` : 'Listo para retiro'}
                      </span>

                      <Link
                        href={`/b/${order.tenantSlug}?step=4&order_id=${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF]/15 px-3 py-1.5 text-xs font-black text-[#00F0FF] uppercase hover:bg-[#00F0FF]/25 transition-colors"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span>Ver QR de Retiro</span>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <QrCode className="h-10 w-10 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-bold text-slate-300">No tenés pedidos recientes</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cuando compres en cualquier boliche adherido, tus pedidos y QRs aparecerán acá.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cierre de Sesión */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        redirectTo="/"
        onSuccess={() => {
          setSession({
            authenticated: false,
            role: 'ANONYMOUS',
            user: null,
          });
        }}
      />
    </>
  );
}
