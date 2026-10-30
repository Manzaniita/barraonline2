'use client';

import React, { useEffect, useState } from 'react';
import {
  FileText,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { formatDateTimeAr } from '@/lib/format';

interface AuditLogItem {
  id: string;
  tenant_id: string | null;
  actor_role: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/superadmin', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction =
      actionFilter === 'ALL' ? true : log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Cabecera */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#00F0FF]">
            <History className="h-3.5 w-3.5" />
            <span>Trazabilidad Inmutable</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Auditoría de Acciones Administrativas
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Registro cronológico inmutable de cambios de estado, publicaciones, modificaciones de configuración y autenticación.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar registros</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#090B12] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-0 my-auto ml-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por acción, entidad o identificador..."
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Acción:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white focus:border-[#00F0FF] focus:outline-none"
          >
            <option value="ALL">Todas las acciones ({logs.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Registros */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#090B12]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-4">Fecha & Hora</th>
                <th className="px-4 py-4">Acción</th>
                <th className="px-4 py-4">Rol Actor</th>
                <th className="px-4 py-4">Entidad</th>
                <th className="px-4 py-4">Detalle / Cambios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {formatDateTimeAr(log.created_at)}
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-extrabold text-white text-xs">
                      {log.action}
                    </span>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      {log.actor_role}
                    </span>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-slate-400 font-mono text-[11px]">
                      {log.entity_type} ({log.entity_id.slice(0, 8)}...)
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="max-w-md truncate font-mono text-[11px] text-slate-400">
                      {log.after_state ? JSON.stringify(log.after_state) : '—'}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No se encontraron registros de auditoría.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
