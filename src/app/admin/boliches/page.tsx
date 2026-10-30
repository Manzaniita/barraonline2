'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { formatDateTimeAr } from '@/lib/format';

interface TenantItem {
  id: string;
  slug: string;
  legalName: string;
  fantasyName: string;
  cuit: string;
  city: string;
  address: string;
  status: 'ONBOARDING' | 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  isPublished: boolean;
  isFeatured: boolean;
  isVisibleOnLanding: boolean;
  sortOrder: number;
  commercialTag: string | null;
  themeConfig: {
    accentPrimary?: string;
    accentSecondary?: string;
    tagline?: string;
    heroBadge?: string;
    logoText?: string;
  };
  totalOrdersCount: number;
  createdAt: string;
}

export default function AdminBolichesPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantItem | null>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    tenant: TenantItem;
    targetStatus: 'ACTIVE' | 'PAUSED_MORA' | 'SUSPENDED';
  } | null>(null);
  const [confirmArchiveModal, setConfirmArchiveModal] = useState<TenantItem | null>(null);

  // Formulario creación / edición
  const [formData, setFormData] = useState({
    fantasyName: '',
    legalName: '',
    cuit: '',
    slug: '',
    city: 'Mar del Plata',
    address: '',
    status: 'ACTIVE' as const,
    isPublished: true,
    isFeatured: false,
    isVisibleOnLanding: true,
    sortOrder: 0,
    commercialTag: '',
    accentPrimary: '#FF2E63',
    accentSecondary: '#00F0FF',
    tagline: 'Pedí desde la pista. Retirá sin fila en barra.',
    heroBadge: 'BARRA RÁPIDA QR',
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/superadmin/tenants', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const openCreateModal = () => {
    setFormData({
      fantasyName: '',
      legalName: '',
      cuit: '',
      slug: '',
      city: 'Mar del Plata',
      address: '',
      status: 'ACTIVE',
      isPublished: true,
      isFeatured: false,
      isVisibleOnLanding: true,
      sortOrder: tenants.length + 1,
      commercialTag: 'TEMPORADA 2026',
      accentPrimary: '#FF2E63',
      accentSecondary: '#00F0FF',
      tagline: 'Pedí desde la pista. Retirá sin fila en barra.',
      heroBadge: 'BARRA RÁPIDA QR',
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (t: TenantItem) => {
    setEditingTenant(t);
    setFormData({
      fantasyName: t.fantasyName,
      legalName: t.legalName,
      cuit: t.cuit,
      slug: t.slug,
      city: t.city,
      address: t.address || '',
      status: t.status as any,
      isPublished: t.isPublished,
      isFeatured: t.isFeatured,
      isVisibleOnLanding: t.isVisibleOnLanding,
      sortOrder: t.sortOrder,
      commercialTag: t.commercialTag || '',
      accentPrimary: t.themeConfig?.accentPrimary || '#FF2E63',
      accentSecondary: t.themeConfig?.accentSecondary || '#00F0FF',
      tagline: t.themeConfig?.tagline || '',
      heroBadge: t.themeConfig?.heroBadge || '',
    });
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: formData.slug,
          fantasyName: formData.fantasyName,
          legalName: formData.legalName,
          cuit: formData.cuit,
          city: formData.city,
          address: formData.address,
          status: formData.status,
          isPublished: formData.isPublished,
          isFeatured: formData.isFeatured,
          isVisibleOnLanding: formData.isVisibleOnLanding,
          sortOrder: Number(formData.sortOrder),
          commercialTag: formData.commercialTag || undefined,
          themeConfig: {
            accentPrimary: formData.accentPrimary,
            accentSecondary: formData.accentSecondary,
            tagline: formData.tagline,
            heroBadge: formData.heroBadge,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear establecimiento.');

      setIsCreateModalOpen(false);
      showToast(`Establecimiento ${formData.fantasyName} creado exitosamente.`);
      fetchTenants();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: editingTenant.id,
          fantasyName: formData.fantasyName,
          legalName: formData.legalName,
          cuit: formData.cuit,
          city: formData.city,
          address: formData.address,
          status: formData.status,
          isPublished: formData.isPublished,
          isFeatured: formData.isFeatured,
          isVisibleOnLanding: formData.isVisibleOnLanding,
          sortOrder: Number(formData.sortOrder),
          commercialTag: formData.commercialTag || null,
          themeConfig: {
            accentPrimary: formData.accentPrimary,
            accentSecondary: formData.accentSecondary,
            tagline: formData.tagline,
            heroBadge: formData.heroBadge,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar.');

      setEditingTenant(null);
      showToast(`Establecimiento ${formData.fantasyName} actualizado.`);
      fetchTenants();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChangeConfirm = async () => {
    if (!confirmStatusModal) return;
    setSaving(true);

    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: confirmStatusModal.tenant.id,
          action: 'TOGGLE_STATUS',
          status: confirmStatusModal.targetStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cambiar estado.');

      setConfirmStatusModal(null);
      showToast(`Estado de ${confirmStatusModal.tenant.fantasyName} actualizado a ${confirmStatusModal.targetStatus}.`);
      fetchTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!confirmArchiveModal) return;
    setSaving(true);

    try {
      const res = await fetch('/api/v1/superadmin/tenants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: confirmArchiveModal.id,
          action: 'ARCHIVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al archivar.');

      setConfirmArchiveModal(null);
      showToast(`Establecimiento ${confirmArchiveModal.fantasyName} archivado.`);
      fetchTenants();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al archivar.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.fantasyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ? true : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
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
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Gestión de Establecimientos
          </h1>
          <p className="text-xs text-slate-400">
            Alta, edición, activación operativa y marcas blancas independientes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#E02454] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,46,99,0.4)] hover:brightness-110 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Crear establecimiento</span>
        </button>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#090B12] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, slug o ciudad..."
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white focus:border-[#00F0FF] focus:outline-none"
          >
            <option value="ALL">Todos ({tenants.length})</option>
            <option value="ACTIVE">Activos</option>
            <option value="ONBOARDING">Onboarding</option>
            <option value="PAUSED_MORA">Pausa Mora</option>
            <option value="SUSPENDED">Suspendidos / Archivados</option>
          </select>

          <button
            type="button"
            onClick={fetchTenants}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-400 hover:text-white"
            title="Refrescar"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabla de Establecimientos */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090B12]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Boliche</th>
                <th className="px-4 py-4">Acceso / Slug</th>
                <th className="px-4 py-4">Ciudad</th>
                <th className="px-4 py-4">Estado Operativo</th>
                <th className="px-4 py-4">Landing</th>
                <th className="px-4 py-4">Destacado</th>
                <th className="px-4 py-4">Pedidos</th>
                <th className="px-5 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              {filteredTenants.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-black text-xs"
                        style={{
                          backgroundColor: `${t.themeConfig?.accentPrimary || '#FF2E63'}22`,
                          borderColor: `${t.themeConfig?.accentPrimary || '#FF2E63'}66`,
                          color: t.themeConfig?.accentPrimary || '#FF2E63',
                        }}
                      >
                        {t.fantasyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-white">
                          {t.fantasyName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {t.legalName} • CUIT {t.cuit}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 font-mono text-[11px]">
                    <span className="text-[#00F0FF]">/b/{t.slug}</span>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-slate-300">{t.city}</span>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        t.status === 'ACTIVE'
                          ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                          : t.status === 'PAUSED_MORA'
                          ? 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                          : 'border border-rose-500/30 bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-400'
                            : t.status === 'PAUSED_MORA'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      />
                      {t.status === 'ACTIVE'
                        ? 'Activo'
                        : t.status === 'PAUSED_MORA'
                        ? 'Pausa Mora'
                        : t.status === 'ONBOARDING'
                        ? 'Onboarding'
                        : 'Suspendido'}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    {t.isPublished && t.isVisibleOnLanding ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <Check className="h-3.5 w-3.5" />
                        <span>Visible</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                        <EyeOff className="h-3.5 w-3.5" />
                        <span>Oculto</span>
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {t.isFeatured ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                        ★ Destacado
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Normal</span>
                    )}
                  </td>

                  <td className="px-4 py-4 font-extrabold text-white">
                    {t.totalOrdersCount}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Ver establecimiento en experiencia pública */}
                      <Link
                        href={`/b/${t.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                        title="Ver establecimiento en pestaña nueva (Marca Blanca)"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>

                      {/* Editar datos */}
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-white"
                        title="Editar información"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      {/* Activar / Desactivar Operativamente */}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmStatusModal({
                            tenant: t,
                            targetStatus: t.status === 'ACTIVE' ? 'PAUSED_MORA' : 'ACTIVE',
                          })
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                          t.status === 'ACTIVE'
                            ? 'border-white/10 bg-white/5 text-slate-400 hover:border-amber-500/40 hover:text-amber-400'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                        title={t.status === 'ACTIVE' ? 'Pausar operativamente' : 'Activar establecimiento'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>

                      {/* Baja Lógica / Archivar */}
                      <button
                        type="button"
                        onClick={() => setConfirmArchiveModal(t)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Archivar boliche (baja lógica segura)"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTenants.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No se encontraron establecimientos con los filtros indicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar Establecimiento */}
      {(isCreateModalOpen || editingTenant) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
        >
          <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141624] to-[#0A0B13] p-6 shadow-2xl sm:p-8 animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingTenant(null);
              }}
              aria-label="Cerrar modal"
              className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00F0FF]">
                {editingTenant ? 'Edición de Establecimiento' : 'Alta de Nuevo Boliche'}
              </span>
              <h2 className="text-xl font-black text-white sm:text-2xl">
                {editingTenant ? `Editar ${editingTenant.fantasyName}` : 'Registrar Nuevo Boliche'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Los cambios se reflejarán inmediatamente en la plataforma sin afectar pedidos históricos.
              </p>
            </div>

            {formError && (
              <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form
              onSubmit={editingTenant ? handleEditSubmit : handleCreateSubmit}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Nombre Comercial */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fantasyName}
                    onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value })}
                    placeholder="Ej. Museum Ocean Club"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>

                {/* Razón Social */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    placeholder="Ej. Nocturno Costanera S.A."
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>

                {/* Slug / Subdominio */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Slug / Identificador Único *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingTenant)}
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    placeholder="ej. museum-costanera"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none disabled:opacity-50"
                  />
                </div>

                {/* CUIT */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    CUIT *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cuit}
                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                    placeholder="30-71548921-9"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>

                {/* Ciudad */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Ciudad *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Mar del Plata"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>

                {/* Dirección */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Playa Grande Sector 4"
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                  />
                </div>
              </div>

              {/* Ajustes de Marca Blanca y Colores */}
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs font-black text-slate-200 mb-3">
                  Configuración Visual & Marca Blanca
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300">
                      Color Primario Neón
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.accentPrimary}
                        onChange={(e) => setFormData({ ...formData, accentPrimary: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded-lg border border-white/15 bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.accentPrimary}
                        onChange={(e) => setFormData({ ...formData, accentPrimary: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-white uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-300">
                      Color Secundario Neón
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.accentSecondary}
                        onChange={(e) => setFormData({ ...formData, accentSecondary: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded-lg border border-white/15 bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.accentSecondary}
                        onChange={(e) => setFormData({ ...formData, accentSecondary: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-white uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[11px] font-bold text-slate-300">
                      Tagline / Frase de la Carta
                    </label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      placeholder="Pedí desde la pista. Retirá sin fila en barra."
                      className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#E02454] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,46,99,0.4)] hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingTenant ? 'Guardar Cambios' : 'Crear Establecimiento'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Cambio de Estado Operativo */}
      {confirmStatusModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-b from-[#141624] to-[#0A0B13] p-6 shadow-2xl sm:p-7">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  ¿Confirmar cambio de estado operativo?
                </h3>
                <p className="text-xs text-slate-400">
                  {confirmStatusModal.tenant.fantasyName}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300 mb-6">
              Estás por cambiar el estado a{' '}
              <strong className="text-white">
                {confirmStatusModal.targetStatus === 'ACTIVE'
                  ? 'ACTIVO'
                  : confirmStatusModal.targetStatus}
              </strong>
              .{' '}
              {confirmStatusModal.targetStatus !== 'ACTIVE'
                ? 'Los clientes no podrán realizar nuevos pedidos ni checkouts en este boliche mientras esté pausado. Los pedidos históricos y registros contables no se alterarán.'
                : 'El boliche volverá a estar operativamente disponible para recibir pedidos.'}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmStatusModal(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStatusChangeConfirm}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black uppercase text-slate-950 hover:bg-amber-400"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirmar cambio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Archivar (Baja Lógica) */}
      {confirmArchiveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="w-full max-w-md rounded-3xl border border-rose-500/30 bg-gradient-to-b from-[#181119] to-[#0A0B13] p-6 shadow-2xl sm:p-7">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/20 text-rose-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  Archivar Establecimiento
                </h3>
                <p className="text-xs text-rose-300">
                  {confirmArchiveModal.fantasyName}
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300 mb-6">
              El establecimiento será suspendido y retirado de la landing pública mediante baja lógica controlada.
              <br />
              <br />
              <strong className="text-white">
                Los pedidos históricos, liquidaciones y auditorías se preservarán intactos.
              </strong>
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmArchiveModal(null)}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-rose-500"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Archivar establecimiento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
