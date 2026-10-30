'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  GlassWater,
  Loader2,
  MapPin,
  QrCode,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from 'lucide-react';
import { SpotlightClubCard } from '@/components/experience/SpotlightClubCard';

interface TenantLandingItem {
  id: string;
  slug: string;
  fantasyName: string;
  city: string;
  address: string;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  isVisibleOnLanding: boolean;
  sortOrder: number;
  commercialTag: string | null;
  themeConfig: {
    accentPrimary?: string;
    accentSecondary?: string;
    accentOnPrimary?: string;
    tagline?: string;
    heroBadge?: string;
  };
}

export default function AdminLandingConfigPage() {
  const [tenants, setTenants] = useState<TenantLandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewTenant, setPreviewTenant] = useState<TenantLandingItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/superadmin/tenants', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list: TenantLandingItem[] = data.tenants || [];
        setTenants(list);
        if (list.length > 0 && !previewTenant) {
          setPreviewTenant(list[0] ?? null);
        }
      }
    } catch (err) {
      console.error('Error fetching landing tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const updateTenantConfig = async (
    tenantId: string,
    updates: Partial<TenantLandingItem>
  ) => {
    setSavingId(tenantId);
    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...updates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar.');

      setTenants((prev) =>
        prev.map((t) => (t.id === tenantId ? { ...t, ...updates } : t))
      );

      if (previewTenant && previewTenant.id === tenantId) {
        setPreviewTenant((prev) => (prev ? { ...prev, ...updates } : null));
      }

      showToast('Configuración de visibilidad actualizada en tiempo real.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSavingId(null);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tenants.length) return;

    const currentTenant = tenants[index];
    const adjacentTenant = tenants[targetIndex];
    if (!currentTenant || !adjacentTenant) return;

    const currentSort = currentTenant.sortOrder;
    const adjacentSort = adjacentTenant.sortOrder;

    // Intercambiamos
    const newCurrentSort = adjacentSort;
    const newAdjacentSort = currentSort === adjacentSort ? (direction === 'UP' ? currentSort - 1 : currentSort + 1) : currentSort;

    await Promise.all([
      updateTenantConfig(currentTenant.id, { sortOrder: newCurrentSort }),
      updateTenantConfig(adjacentTenant.id, { sortOrder: newAdjacentSort }),
    ]);

    fetchTenants();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notificación */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-bold text-emerald-200 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabecera Sección */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#00F0FF]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Gestor de Publicación</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Configuración de Boliches en la Landing
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Controlá qué establecimientos aparecen públicamente en «Boliches adheridos», su orden y distintivos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>Ver landing comercial</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={fetchTenants}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-slate-400 hover:text-white"
            title="Refrescar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid: 2 Columnas (Controles de Boliches + Vista Previa en Vivo) */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Columna Izquierda: Listado y Controles (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-2xl border border-white/10 bg-[#090B12] p-4 text-xs text-slate-300 flex items-center justify-between">
            <div>
              <p className="font-extrabold text-white">Reglas de Publicación Activas</p>
              <p className="text-[11px] text-slate-400">
                Solo se mostrarán en la landing los boliches con <span className="text-emerald-400 font-bold">Estado Activo</span>, <span className="text-emerald-400 font-bold">Publicado = Sí</span> y <span className="text-emerald-400 font-bold">Visible en Landing = Sí</span>.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {tenants.map((t, index) => {
              const isSelectedForPreview = previewTenant?.id === t.id;
              const willShowOnLanding =
                t.status === 'ACTIVE' && t.isPublished && t.isVisibleOnLanding;

              return (
                <div
                  key={t.id}
                  className={`rounded-2xl border p-5 transition-all ${
                    isSelectedForPreview
                      ? 'border-[#00F0FF]/60 bg-gradient-to-b from-[#131726] to-[#0A0D18] shadow-[0_0_24px_rgba(0,240,255,0.15)]'
                      : 'border-white/10 bg-[#090B12] hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-base text-white">
                          {t.fantasyName}
                        </h3>
                        <span className="font-mono text-xs text-slate-400">
                          /{t.slug}
                        </span>
                        {t.isFeatured && (
                          <span className="rounded-full border border-amber-400/50 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                            ★ Destacado
                          </span>
                        )}
                        {willShowOnLanding ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                            En vivo en landing
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-600/40 bg-slate-800/40 px-2 py-0.5 text-[10px] font-black uppercase text-slate-400">
                            No visible en landing
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {t.city} • Orden: <strong className="text-white">{t.sortOrder}</strong>
                        {t.commercialTag && ` • Etiqueta: "${t.commercialTag}"`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Reordenar */}
                      <button
                        type="button"
                        disabled={index === 0 || savingId === t.id}
                        onClick={() => handleMoveOrder(index, 'UP')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Mover arriba en el orden"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === tenants.length - 1 || savingId === t.id}
                        onClick={() => handleMoveOrder(index, 'DOWN')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white disabled:opacity-30"
                        title="Mover abajo en el orden"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewTenant(t)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          isSelectedForPreview
                            ? 'bg-[#00F0FF] text-slate-950 font-black'
                            : 'border border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {isSelectedForPreview ? 'Previsualizando' : 'Previsualizar'}
                      </button>
                    </div>
                  </div>

                  {/* Fila de Toggles de Configuración */}
                  <div className="mt-4 pt-4 border-t border-white/10 grid gap-3 sm:grid-cols-3">
                    {/* Toggle Visible en Landing */}
                    <button
                      type="button"
                      disabled={savingId === t.id}
                      onClick={() =>
                        updateTenantConfig(t.id, {
                          isVisibleOnLanding: !t.isVisibleOnLanding,
                        })
                      }
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                        t.isVisibleOnLanding
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-white/10 bg-white/[0.02] text-slate-400'
                      }`}
                    >
                      <span>Visible en Landing</span>
                      {t.isVisibleOnLanding ? (
                        <Eye className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-slate-500" />
                      )}
                    </button>

                    {/* Toggle Destacado */}
                    <button
                      type="button"
                      disabled={savingId === t.id}
                      onClick={() =>
                        updateTenantConfig(t.id, {
                          isFeatured: !t.isFeatured,
                        })
                      }
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                        t.isFeatured
                          ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                          : 'border-white/10 bg-white/[0.02] text-slate-400'
                      }`}
                    >
                      <span>Destacado (Top)</span>
                      <Sparkles
                        className={`h-4 w-4 ${
                          t.isFeatured ? 'text-amber-400' : 'text-slate-500'
                        }`}
                      />
                    </button>

                    {/* Toggle Publicado */}
                    <button
                      type="button"
                      disabled={savingId === t.id}
                      onClick={() =>
                        updateTenantConfig(t.id, {
                          isPublished: !t.isPublished,
                        })
                      }
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold transition-colors ${
                        t.isPublished
                          ? 'border-[#00F0FF]/40 bg-[#00F0FF]/10 text-cyan-200'
                          : 'border-white/10 bg-white/[0.02] text-slate-400'
                      }`}
                    >
                      <span>Publicado Comercial</span>
                      <Check
                        className={`h-4 w-4 ${
                          t.isPublished ? 'text-[#00F0FF]' : 'text-slate-500'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Input de Etiqueta Comercial Opcional */}
                  <div className="mt-3 flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      defaultValue={t.commercialTag || ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (t.commercialTag || '')) {
                          updateTenantConfig(t.id, { commercialTag: val || null });
                        }
                      }}
                      placeholder="Etiqueta comercial (ej. TEMPORADA 2026, FRENTE AL MAR)..."
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}

            {tenants.length === 0 && !loading && (
              <p className="py-12 text-center text-xs text-slate-400">
                No hay establecimientos registrados para configurar.
              </p>
            )}
          </div>
        </div>

        {/* Columna Derecha: Vista Previa Real de la Tarjeta (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 rounded-3xl border border-white/10 bg-[#090B12] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00F0FF]">
                  Live Preview
                </span>
                <h3 className="text-base font-black text-white">
                  Vista Previa en Landing Comercial
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-slate-400">
                Card 3D Interactive
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-6">
              Así verán los clientes este establecimiento en la sección pública «Boliches adheridos»:
            </p>

            {previewTenant ? (
              <div className="flex justify-center">
                <div className="w-full max-w-sm">
                  <SpotlightClubCard
                    id={previewTenant.id}
                    slug={previewTenant.slug}
                    fantasyName={previewTenant.fantasyName}
                    city={previewTenant.city}
                    address={previewTenant.address}
                    accentPrimary={previewTenant.themeConfig?.accentPrimary || '#FF2E63'}
                    accentSecondary={previewTenant.themeConfig?.accentSecondary || '#00F0FF'}
                    accentOnPrimary={previewTenant.themeConfig?.accentOnPrimary || '#FFFFFF'}
                    heroBadge={previewTenant.themeConfig?.heroBadge || 'BOLICHE ADHERIDO'}
                    tagline={
                      previewTenant.themeConfig?.tagline ||
                      'Pedí tus bebidas desde la pista, pagá seguro y retirá con QR sin hacer filas.'
                    }
                    isFeatured={previewTenant.isFeatured}
                    commercialTag={previewTenant.commercialTag}
                    index={0}
                  />
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-500">
                Seleccioná un boliche para previsualizarlo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
