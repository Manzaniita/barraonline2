'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { LogoutModal } from '@/components/auth/LogoutModal';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isSuperadmin: boolean;
}

interface AdminShellProps {
  user: AdminUser;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Establecimientos',
    href: '/admin/boliches',
    icon: Building2,
  },
  {
    label: 'Visibilidad en Landing',
    href: '/admin/landing',
    icon: SlidersHorizontal,
  },
  {
    label: 'Mi Cuenta & Seguridad',
    href: '/admin/cuenta',
    icon: User,
  },
  {
    label: 'Auditoría',
    href: '/admin/auditoria',
    icon: History,
  },
];

export function AdminSidebarAndHeader({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  // Si estamos en la pantalla de login, renderizamos el contenido directamente sin la barra lateral
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#05060A] text-slate-100">
      {/* Sidebar de Escritorio */}
      <aside className="hidden w-64 flex-col border-r border-white/10 bg-[#090B12] lg:flex">
        {/* Cabecera Sidebar */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <img
              src="/logo-barraonline.png"
              alt="BarraOnline"
              className="h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(0,240,255,0.4)]"
            />
          </Link>
          <span className="rounded-md border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#00F0FF]">
            SUPERADMIN
          </span>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 space-y-1.5 p-4">
          <div className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            Control SaaS
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  isActive
                    ? 'border border-[#00F0FF]/30 bg-[#00F0FF]/15 text-[#00F0FF] shadow-[0_0_16px_rgba(0,240,255,0.15)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? 'text-[#00F0FF]' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar: Usuario + Logout */}
        <div className="border-t border-white/10 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">
                  {user.fullName}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogoutModalOpen(true)}
                title="Cerrar sesión"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenedor Principal */}
      <div className="flex flex-1 flex-col">
        {/* Header Superior Administrativo */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#090B12]/90 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-300 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Modo Superadministrador
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <span>Ver landing pública</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => setLogoutModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Drawer Móvil de Navegación */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-md lg:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileMenuOpen(false);
            }}
          >
            <div className="w-72 bg-[#090B12] p-5 flex flex-col justify-between border-r border-white/10 animate-in slide-in-from-left">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <img
                      src="/logo-barraonline.png"
                      alt="BarraOnline"
                      className="h-7 w-auto object-contain"
                    />
                    <span className="text-[10px] font-black uppercase text-[#00F0FF]">
                      SUPERADMIN
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Cerrar menú"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1.5">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin' && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold ${
                          isActive
                            ? 'border border-[#00F0FF]/30 bg-[#00F0FF]/15 text-[#00F0FF]'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-slate-400 truncate mb-3">{user.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setLogoutModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Dinámico */}
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>

      {/* Modal de Cierre de Sesión */}
      <LogoutModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        redirectTo="/admin/login"
      />
    </div>
  );
}
