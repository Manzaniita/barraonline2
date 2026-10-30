'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  History,
  Layers,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { formatArsFromCents, formatDateTimeAr } from '@/lib/format';

interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  publishedTenants: number;
  featuredTenants: number;
  totalOrders: number;
  approvedOrders: number;
  totalVolumeCents: number;
  unsettledCommissionsCents: number;
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

interface TenantBrief {
  id: string;
  slug: string;
  fantasyName: string;
  city: string;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  isVisibleOnLanding: boolean;
  totalOrdersCount: number;
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantBrief[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, superadminRes] = await Promise.all([
        fetch('/api/v1/superadmin/tenants', { cache: 'no-store' }),
        fetch('/api/v1/superadmin', { cache: 'no-store' }),
      ]);

      if (tenantsRes.ok) {
        const tData = await tenantsRes.json();
        const tList: TenantBrief[] = tData.tenants || [];
        setTenants(tList);

        const total = tList.length;
        const active = tList.filter((t) => t.status === 'ACTIVE').length;
        const published = tList.filter((t) => t.isPublished).length;
        const featured = tList.filter((t) => t.isFeatured).length;
        const ordersCount = tList.reduce((acc, t) => acc + (t.totalOrdersCount || 0), 0);

        setMetrics((prev) => ({
          totalTenants: total,
          activeTenants: active,
          publishedTenants: published,
          featuredTenants: featured,
          totalOrders: ordersCount,
          approvedOrders: prev?.approvedOrders ?? 0,
          totalVolumeCents: prev?.totalVolumeCents ?? 0,
          unsettledCommissionsCents: prev?.unsettledCommissionsCents ?? 0,
        }));
      }

      if (superadminRes.ok) {
        const sData = await superadminRes.json();
        setAuditLogs(sData.auditLogs || []);

        // Calculamos métricas financieras agregadas reales
        let totalVol = 0;
        let unsettled = 0;
        if (sData.tenants) {
          unsettled = sData.tenants.reduce(
            (sum: number, t: { unsettledCommissionCents?: number }) =>
              sum + (t.unsettledCommissionCents || 0),
            0
          );
        }
        if (sData.settlements) {
          totalVol = sData.settlements.reduce(
            (sum: number, s: { grossSalesCents?: number }) =>
              sum + (s.grossSalesCents || 0),
            0
          );
        }

        setMetrics((prev) => ({
          totalTenants: prev?.totalTenants ?? 0,
          activeTenants: prev?.activeTenants ?? 0,
          publishedTenants: prev?.publishedTenants ?? 0,
          featuredTenants: prev?.featuredTenants ?? 0,
          totalOrders: prev?.totalOrders ?? 0,
          approvedOrders: prev?.approvedOrders ?? 0,
          totalVolumeCents: totalVol,
          unsettledCommissionsCents: unsettled,
        }));
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#00F0FF]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Centro de Control General</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Panel de Superadministración
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Monitoreo en tiempo real de establecimientos, visibilidad en landing, facturación y auditoría.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar datos</span>
          </button>

          <Link
            href="/admin/boliches"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#E02454] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,46,99,0.4)] hover:brightness-110 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo establecimiento</span>
          </Link>
        </div>
      </div>

      {/* Tarjetas de Indicadores Generales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Boliches */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#131623] to-[#0B0D16] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Total Establecimientos
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#00F0FF]">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-white">
              {metrics?.totalTenants ?? '—'}
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {metrics?.activeTenants ?? 0} activos
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics?.totalTenants ? `${metrics.totalTenants - (metrics.activeTenants || 0)} en onboarding/pausa` : 'Cargando...'}
          </p>
        </div>

        {/* Publicados en Landing */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#131623] to-[#0B0D16] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Publicados en Landing
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF]">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-white">
              {metrics?.publishedTenants ?? '—'}
            </span>
            <span className="text-xs font-bold text-amber-400">
              ★ {metrics?.featuredTenants ?? 0} destacados
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Visibles en la sección pública «Boliches adheridos»
          </p>
        </div>

        {/* Pedidos Totales */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#131623] to-[#0B0D16] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Pedidos Totales
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#FF2E63]/30 bg-[#FF2E63]/10 text-[#FF2E63]">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-white">
              {metrics?.totalOrders ?? '—'}
            </span>
            <span className="text-xs font-bold text-slate-300">
              en plataforma
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Historial de checkouts en todos los boliches
          </p>
        </div>

        {/* Comisiones por Liquidar */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#131623] to-[#0B0D16] p-5 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Comisiones a Liquidar
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-emerald-300 sm:text-3xl">
              {metrics ? formatArsFromCents(metrics.unsettledCommissionsCents) : '—'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Ingresos generados pendientes de liquidación semanal
          </p>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/boliches"
          className="group rounded-2xl border border-white/10 bg-[#0E111B] p-5 transition-all hover:border-[#00F0FF]/40 hover:bg-[#121624]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#00F0FF] group-hover:scale-110 transition-transform">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Gestionar Boliches</h3>
                <p className="text-xs text-slate-400">Alta, edición, estados operativos y archivo</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/admin/landing"
          className="group rounded-2xl border border-white/10 bg-[#0E111B] p-5 transition-all hover:border-[#FF2E63]/40 hover:bg-[#121624]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#FF2E63] group-hover:scale-110 transition-transform">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Configurar Landing</h3>
                <p className="text-xs text-slate-400">Boliches visibles, destacados y orden</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          href="/admin/cuenta"
          className="group rounded-2xl border border-white/10 bg-[#0E111B] p-5 transition-all hover:border-amber-400/40 hover:bg-[#121624]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Mi Cuenta & Seguridad</h3>
                <p className="text-xs text-slate-400">Cambiar contraseña y cerrar sesiones</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Dos Columnas: Establecimientos Resumen & Actividad Reciente */}
      <div className="grid gap-8 lg:grid-cols-7">
        {/* Columna Izquierda: Establecimientos Principales (4 cols) */}
        <div className="rounded-3xl border border-white/10 bg-[#090B12] p-6 lg:col-span-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-black text-white sm:text-lg">
                Establecimientos Registrados
              </h2>
              <p className="text-xs text-slate-400">
                Resumen de visibilidad y estado operativo
              </p>
            </div>
            <Link
              href="/admin/boliches"
              className="text-xs font-bold text-[#00F0FF] hover:underline"
            >
              Ver todos →
            </Link>
          </div>

          <div className="space-y-3">
            {tenants.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.06]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm text-white truncate">
                      {t.fantasyName}
                    </h3>
                    {t.isFeatured && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300">
                        Destacado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    /{t.slug} • {t.city} • {t.totalOrdersCount || 0} pedidos
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                      t.status === 'ACTIVE'
                        ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                        : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {t.status === 'ACTIVE' ? 'Activo' : t.status}
                  </span>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      t.isPublished && t.isVisibleOnLanding
                        ? 'bg-blue-500/15 text-blue-300'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {t.isPublished && t.isVisibleOnLanding ? 'En landing' : 'Oculto'}
                  </span>

                  <Link
                    href={`/b/${t.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                    title="Ver experiencia pública"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}

            {tenants.length === 0 && !loading && (
              <p className="py-8 text-center text-xs text-slate-400">
                No hay establecimientos registrados.
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Auditoría Reciente (3 cols) */}
        <div className="rounded-3xl border border-white/10 bg-[#090B12] p-6 lg:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-black text-white sm:text-lg">
                Auditoría Reciente
              </h2>
              <p className="text-xs text-slate-400">
                Registro inmutable de acciones administrativas
              </p>
            </div>
            <Link
              href="/admin/auditoria"
              className="text-xs font-bold text-[#00F0FF] hover:underline"
            >
              Historial →
            </Link>
          </div>

          <div className="space-y-3">
            {auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-white text-[11px] truncate">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {formatDateTimeAr(log.created_at)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Rol: <strong className="text-slate-300">{log.actor_role}</strong> • Entidad: {log.entity_type}
                </p>
              </div>
            ))}

            {auditLogs.length === 0 && !loading && (
              <p className="py-8 text-center text-xs text-slate-400">
                Sin registros de auditoría recientes.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
