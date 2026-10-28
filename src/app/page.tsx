import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Lock,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ensureDemoDataSeeded } from '@/db/seed';
import { listAllTenantsForDirectory } from '@/modules/tenancy/tenant-service';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureDemoDataSeeded();
  const tenants = await listAllTenantsForDirectory();

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100">
      {/* Glow ambiental controlado sin penalizar GPU */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,46,99,0.22),transparent)]"
      />

      {/* Barra Superior Central */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070709]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF2E63] font-black text-white shadow-[0_0_24px_rgba(255,46,99,0.45)]">
              BO
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                BARRA<span className="text-[#FF2E63]">ONLINE</span>
              </span>
              <span className="ml-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
                Costa Argentina
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/superadmin"
              className="bo-gpu-transition inline-flex items-center gap-2 rounded-xl border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-4 py-2.5 text-xs font-bold tracking-wide text-[#00F0FF] uppercase hover:bg-[#00F0FF]/20"
            >
              <ShieldCheck className="h-4 w-4" />
              Panel Superadministrador
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Hero Principal */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#11131A] via-[#0D0F16] to-[#161224] p-6 sm:p-10">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF2E63]/40 bg-[#FF2E63]/15 px-3.5 py-1 text-xs font-bold tracking-wider text-[#FF2E63] uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              SaaS Multi-Tenant Nocturno • Aislamiento PostgreSQL 16 RLS
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
              Pedí desde la pista.{' '}
              <span className="bg-gradient-to-r from-[#FF2E63] via-rose-400 to-[#00F0FF] bg-clip-text text-transparent">
                Pagá directo al boliche y retirá con QR Único sin fila.
              </span>
            </h1>

            <p className="text-base leading-relaxed text-slate-300 sm:text-lg">
              Cada establecimiento opera en su propio subdominio aislado con su carta,
              precios, stock reservado en checkout y su propia cuenta de Mercado Pago
              vinculada por OAuth 2.0 (sin Split de Pagos). BarraOnline registra el libro
              mayor de comisiones y emite las liquidaciones semanales auditables.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#00F0FF] uppercase">
                  <Lock className="h-4 w-4" />
                  Aislamiento RLS
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  PostgreSQL 16 con <code className="text-slate-200">FORCE RLS</code> y
                  bóveda AES-256-GCM por tenant.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase">
                  <Zap className="h-4 w-4" />
                  Cobro 100% Directo
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  El dinero acredita directo en el Mercado Pago del boliche (sin Split).
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#FF2E63] uppercase">
                  <QrCode className="h-4 w-4" />
                  QR Uso Único
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  192 bits de entropía, quemado atómico en barra y gestión de conflictos.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase">
                  <Receipt className="h-4 w-4" />
                  Liquidación Semanal
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Ledger inmutable de comisiones, devoluciones y conciliación manual.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Directorio de Boliches Activos */}
        <section className="mt-10 space-y-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                Boliches Operativos en el MVP (Piloto 2 Establecimientos)
              </h2>
              <p className="text-sm text-slate-400">
                Elegí un boliche para entrar como Cliente Móvil, Operador de Barra o Dueño
                del Establecimiento.
              </p>
            </div>
            <div className="text-xs font-medium text-slate-400">
              Subdominios configurados:{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">
                *.barraonline.com.ar
              </code>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {tenants.map((tenant) => {
              const accent = tenant.theme_config?.accentPrimary || '#FF2E63';
              return (
                <article
                  key={tenant.id}
                  className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#11131A] p-6 shadow-2xl transition hover:border-white/25"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span
                          style={{
                            borderColor: `${accent}66`,
                            backgroundColor: `${accent}22`,
                            color: accent,
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold tracking-wider uppercase"
                        >
                          <Building2 className="h-3 w-3" />
                          {tenant.city} • {tenant.theme_config?.heroBadge || 'CLUB ACTIVO'}
                        </span>
                        <h3 className="mt-2 text-2xl font-black text-white">
                          {tenant.fantasy_name}
                        </h3>
                        <p className="text-xs text-slate-400">
                          Subdominio oficial:{' '}
                          <span className="font-mono text-slate-200">
                            https://{tenant.slug}.barraonline.com.ar
                          </span>{' '}
                          • Razón Social: {tenant.legal_name} (CUIT {tenant.cuit})
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                          tenant.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {tenant.status === 'ACTIVE' ? 'Operativo' : tenant.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-300">
                      {tenant.theme_config?.tagline ||
                        'Carta nocturna digital con pago directo y retiro exprés.'}
                    </p>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Reserva stock: {tenant.reservation_ttl_seconds / 60} min
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Corte noche comercial: {tenant.business_day_cutoff_hour}:00 hs
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        PIN Barra Demo: <strong className="text-white">482910</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-2.5 pt-4 border-t border-white/10 sm:grid-cols-3">
                    <Link
                      href={`/b/${tenant.slug}`}
                      style={{
                        backgroundColor: accent,
                        color: tenant.theme_config?.accentOnPrimary || '#FFFFFF',
                      }}
                      className="bo-gpu-transition flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black tracking-wide uppercase shadow-lg"
                    >
                      1. Carta Cliente
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>

                    <Link
                      href={`/b/${tenant.slug}/bar`}
                      className="bo-gpu-transition flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-bold tracking-wide text-emerald-300 uppercase hover:bg-emerald-500/20"
                    >
                      <QrCode className="h-4 w-4" />
                      2. Consola Barra
                    </Link>

                    <Link
                      href={`/b/${tenant.slug}/admin`}
                      className="bo-gpu-transition flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold tracking-wide text-slate-200 uppercase hover:bg-white/10"
                    >
                      3. Panel Dueño
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
