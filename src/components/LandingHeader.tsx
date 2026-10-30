'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronDown,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
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

const NAV_ITEMS = [
  { href: '#boliches', label: 'Boliches adheridos', id: 'boliches' },
  { href: '#como-funciona', label: 'Cómo funciona', id: 'como-funciona' },
  { href: '#beneficios', label: 'Beneficios', id: 'beneficios' },
  { href: '#para-boliches', label: 'Para tu boliche', id: 'para-boliches' },
  { href: '#contacto', label: 'Contacto', id: 'contacto' },
];

export function LandingHeader() {
  const [session, setSession] = useState<SessionState>({
    authenticated: false,
    role: 'ANONYMOUS',
    user: null,
  });

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Detección de scroll para ajustar altura y backdrop-blur
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Observador de secciones para marcar navegación activa
  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0.1,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
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
        return { label: 'Dueño', color: 'bg-[#FF007A]/15 text-[#FF007A] border-[#FF007A]/30' };
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
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out ${
          scrolled
            ? 'h-[60px] bg-[#060608]/90 backdrop-blur-xl border-b border-white/[0.08] shadow-[0_12px_32px_rgba(0,0,0,0.7)]'
            : 'h-[72px] bg-[#060608]/50 backdrop-blur-md border-b border-white/[0.04]'
        }`}
      >
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* 1. Lado Izquierdo: Logo BarraOnline */}
          <Link
            href="/"
            className="group flex items-center gap-2 transition-transform duration-200 hover:opacity-95 shrink-0"
            aria-label="BarraOnline — Inicio"
          >
            <img
              src="/logo-barraonline.png"
              alt="BarraOnline"
              className="h-7 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02] sm:h-8 lg:h-9"
            />
          </Link>

          {/* 2. Centro: Navegación Principal Alineada (Desktop) */}
          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-1 rounded-full border border-white/[0.07] bg-[#0e1017]/60 p-1 backdrop-blur-md lg:flex shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-full px-3.5 xl:px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white/[0.1] text-white font-semibold shadow-[0_0_12px_rgba(255,0,122,0.18)] border border-[#FF007A]/35'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* 3. Lado Derecho: Acciones y CTAs */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Acceso Secundario: Mi Cuenta (visible en tablet y desktop, integrado en menú móvil en celular) */}
            {session.authenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-[13px] font-medium text-slate-200 transition-all hover:border-white/[0.22] hover:bg-white/[0.08]"
                >
                  <UserCheck className="h-3.5 w-3.5 text-[#00F0FF]" />
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {session.user?.fullName?.split(' ')[0] || 'Mi cuenta'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/[0.12] bg-[#0d0f18]/95 p-2 shadow-[0_20px_45px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-in fade-in zoom-in-95"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="border-b border-white/[0.08] px-3 py-2.5">
                      <p className="text-[11px] font-medium text-slate-400">Sesión activa</p>
                      <p className="truncate text-xs font-bold text-white">
                        {session.user?.fullName}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {session.user?.email}
                      </p>
                      {badgeInfo && (
                        <span
                          className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeInfo.color}`}
                        >
                          {badgeInfo.label}
                        </span>
                      )}
                    </div>

                    {session.redirectUrl && session.redirectUrl !== '/' && (
                      <Link
                        href={session.redirectUrl}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[#00F0FF] transition-colors hover:bg-white/[0.06]"
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

                    <button
                      type="button"
                      onClick={() => setIsOrdersModalOpen(true)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.06] text-left"
                    >
                      <QrCode className="h-4 w-4 text-[#FF007A]" />
                      <span>Mis pedidos y códigos QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsLogoutModalOpen(true)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/10 text-left"
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
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs sm:text-[13px] font-medium text-slate-300 transition-all hover:border-white/[0.22] hover:bg-white/[0.07] hover:text-white"
              >
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Mi cuenta</span>
              </button>
            )}

            {/* CTA Principal Comercial */}
            <a
              href="#contacto"
              className="bo-btn-laser inline-flex items-center gap-1.5 rounded-xl bg-[#FF007A] px-2.5 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold tracking-wide text-white uppercase shadow-[0_0_18px_rgba(255,0,122,0.35)] transition-all hover:bg-[#FF1A8C]"
            >
              <span className="hidden sm:inline">Quiero BarraOnline</span>
              <span className="sm:hidden">Quiero BO</span>
              <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </a>

            {/* Botón Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-slate-300 transition-colors hover:text-white hover:bg-white/[0.08] lg:hidden"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Desplegable Menú Móvil */}
        {isMobileMenuOpen && (
          <div className="border-b border-white/[0.1] bg-[#080911]/98 px-5 pt-3 pb-6 shadow-[0_25px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl lg:hidden animate-in slide-in-from-top-3 duration-200">
            <nav className="flex flex-col space-y-1 text-sm font-medium text-slate-200">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-white font-semibold border-l-2 border-[#FF007A]'
                        : 'hover:bg-white/[0.04] text-slate-300'
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#FF007A]" />
                    )}
                  </a>
                );
              })}
            </nav>

            <div className="mt-5 border-t border-white/[0.08] pt-4 flex flex-col gap-2.5">
              <a
                href="#contacto"
                onClick={() => setIsMobileMenuOpen(false)}
                className="bo-btn-laser flex items-center justify-center gap-2 rounded-xl bg-[#FF007A] py-3 text-xs font-bold uppercase tracking-wide text-white shadow-[0_0_24px_rgba(255,0,122,0.45)]"
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] py-2.5 text-xs font-medium text-slate-200 hover:text-white"
                >
                  <User className="h-4 w-4 text-slate-400" />
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
        onSuccess={() => {
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
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#121422] to-[#090a10] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)] sm:p-7 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsOrdersModalOpen(false)}
              aria-label="Cerrar ventana"
              className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-colors hover:border-white/[0.16] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#00F0FF]">
                Historial de Compras
              </span>
              <h3 className="font-display text-xl font-bold text-white">Mis Pedidos y Códigos QR</h3>
              <p className="text-xs text-slate-400">
                Visualizá tus pedidos confirmados para retirar en la barra.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {session.orders && session.orders.length > 0 ? (
                session.orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-[#00F0FF]">
                          {order.tenantFantasyName}
                        </span>
                        <h4 className="text-sm font-semibold text-white">
                          Pedido #{order.orderNumber}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {formatDateTimeAr(order.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-display text-sm font-bold text-white">
                          {formatArsFromCents(order.totalCents)}
                        </span>
                        <div>
                          <span
                            className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
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

                    <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-[11px] text-slate-300">
                        {order.shortCode ? `Código: ${order.shortCode}` : 'Listo para retiro'}
                      </span>

                      <Link
                        href={`/b/${order.tenantSlug}?step=4&order_id=${order.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#00F0FF]/15 px-3 py-1.5 text-xs font-bold text-[#00F0FF] uppercase hover:bg-[#00F0FF]/25 transition-colors"
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
                  <p className="text-sm font-medium text-slate-300">No tenés pedidos recientes</p>
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
