'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { UnifiedAuthModal } from '@/components/auth/UnifiedAuthModal';
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
  role: 'SUPERADMIN' | 'ADMIN' | 'DUEÑO' | 'GERENTE' | 'CAJERO' | 'CLIENTE' | 'ANONYMOUS';
  rawRole?: string;
  user: {
    id?: string;
    email?: string;
    fullName?: string;
    avatarUrl?: string | null;
    role?: string;
    tenantSlug?: string | null;
    tenantFantasyName?: string | null;
  } | null;
  redirectUrl?: string;
  orders?: CustomerOrder[];
}

export function LandingHeader() {
  const [session, setSession] = useState<SessionState>({
    authenticated: false,
    role: 'ANONYMOUS',
    user: null,
  });

  const [scrolled, setScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const refreshSession = () => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.authenticated) {
          setSession(data);
        } else {
          setSession({
            authenticated: false,
            role: 'ANONYMOUS',
            user: null,
          });
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPERADMIN':
        return { label: 'Superadmin', color: 'bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF]/30' };
      case 'DUEÑO':
        return { label: 'Dueño', color: 'bg-[#FF2E63]/15 text-[#FF2E63] border-[#FF2E63]/30' };
      case 'GERENTE':
        return { label: 'Gerente', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
      case 'CAJERO':
        return { label: 'Cajero / Barra', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'ADMIN':
        return { label: 'Admin', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
      default:
        return { label: 'Cliente', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
  };

  const badgeInfo = session.authenticated ? getRoleBadge(session.role) : null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-[#040407]/90 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl border-b border-white/10'
            : 'bg-[#040407]/60 py-4 backdrop-blur-md border-b border-white/5'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo Principal BarraOnline */}
          <Link href="/" className="group flex items-center gap-3">
            <img
              src="/logo-barraonline.png"
              alt="BarraOnline — Plataforma Comercial para Boliches y Bares"
              className="h-9 w-auto object-contain drop-shadow-[0_0_16px_rgba(0,229,255,0.35)] transition-transform duration-300 group-hover:scale-105 sm:h-10"
            />
            <span className="hidden rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-[#00F0FF] uppercase lg:inline-block">
              SaaS Boliches
            </span>
          </Link>

          {/* Navegación Principal Comercial (Desktop) */}
          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-6 text-xs font-black tracking-wider text-slate-300 uppercase md:flex lg:gap-8"
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
              href="#beneficios"
              className="transition-colors hover:text-white"
            >
              Beneficios
            </a>
            <a
              href="#para-boliches"
              className="transition-colors hover:text-[#00F0FF]"
            >
              Para tu boliche
            </a>
            <a
              href="#contacto"
              className="transition-colors hover:text-[#FF2E63]"
            >
              Contacto
            </a>
          </nav>

          {/* Acciones y CTAs del Header */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* CTA Principal Comercial: Prioridad Visual */}
            <a
              href="#contacto"
              className="bo-btn-laser inline-flex items-center gap-2 rounded-xl bg-[#FF2E63] px-3.5 py-2 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_24px_rgba(255,46,99,0.5)] transition-transform hover:scale-105 active:scale-95 sm:px-4 sm:py-2.5"
            >
              <span>Quiero BarraOnline</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>

            {/* Acceso Unificado a Cuentas: Botón Discreto */}
            {session.authenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-white/10 hover:border-white/30"
                >
                  <UserCheck className="h-4 w-4 text-[#00F0FF]" />
                  <span className="hidden max-w-[110px] truncate sm:inline">
                    {session.user?.fullName?.split(' ')[0] || 'Mi cuenta'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/15 bg-[#0C0F17]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl animate-in fade-in zoom-in-95"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-slate-400">Sesión activa</p>
                      <p className="truncate text-xs font-black text-white">
                        {session.user?.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {session.user?.email}
                      </p>
                      {badgeInfo && (
                        <span
                          className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${badgeInfo.color}`}
                        >
                          {badgeInfo.label}
                        </span>
                      )}
                    </div>

                    {/* Acceso directo a su panel autorizado según el rol identificado */}
                    {session.redirectUrl && session.redirectUrl !== '/' && (
                      <Link
                        href={session.redirectUrl}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-[#00F0FF] transition-colors hover:bg-white/10"
                      >
                        <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
                        <span>
                          {session.role === 'SUPERADMIN'
                            ? 'Panel de control general'
                            : session.role === 'CAJERO'
                            ? 'Terminal de barra'
                            : 'Panel de mi boliche'}
                        </span>
                      </Link>
                    )}

                    {/* Para clientes o usuarios con pedidos */}
                    <button
                      type="button"
                      onClick={() => setIsOrdersModalOpen(true)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10 text-left"
                    >
                      <QrCode className="h-4 w-4 text-[#FF2E63]" />
                      <span>Mis pedidos y códigos QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLogoutModalOpen(true)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10 text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-400" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-300 transition-all hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 hover:text-white active:scale-95 sm:px-3.5 sm:py-2.5"
              >
                <User className="h-3.5 w-3.5 text-[#00F0FF]" />
                <span className="hidden sm:inline">Mi cuenta</span>
              </button>
            )}

            {/* Toggle Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 md:hidden hover:text-white"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Desplegable Menú Móvil */}
        {isMobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#07080E]/95 px-4 pt-4 pb-6 backdrop-blur-2xl md:hidden animate-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col space-y-3 text-sm font-black tracking-wider text-slate-200 uppercase">
              <a
                href="#boliches"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
              >
                Boliches adheridos
              </a>
              <a
                href="#como-funciona"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
              >
                Cómo funciona
              </a>
              <a
                href="#beneficios"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
              >
                Beneficios
              </a>
              <a
                href="#para-boliches"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
              >
                Para tu boliche
              </a>
              <a
                href="#contacto"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
              >
                Contacto comercial
              </a>
            </nav>

            <div className="mt-5 border-t border-white/10 pt-4 flex flex-col gap-2.5">
              <a
                href="#contacto"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#FF2E63] py-3 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(255,46,99,0.5)]"
              >
                <span>Quiero BarraOnline</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              {!session.authenticated && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-xs font-black uppercase text-slate-300 hover:text-white"
                >
                  <User className="h-4 w-4 text-[#00F0FF]" />
                  <span>Ingresar a mi cuenta</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Modal de Acceso Unificado */}
      <UnifiedAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          refreshSession();
        }}
      />

      {/* Modal de Mis Pedidos y Códigos QR */}
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
