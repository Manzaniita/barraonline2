'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
} from 'lucide-react';
import { validatePasswordStrength } from '@/modules/identity/admin-session-edge';

export default function AdminAccountPage() {
  const [profile, setProfile] = useState<{
    email: string;
    fullName: string;
    role: string;
    status: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [savingPassword, setSavingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.role === 'SUPERADMIN') {
          setProfile({
            email: data.user.email,
            fullName: data.user.fullName,
            role: 'SUPERADMIN',
            status: 'ACTIVO',
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const strength = validatePasswordStrength(newPassword);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    if (!strength.valid) {
      setErrorMessage(strength.message || 'La nueva contraseña no cumple los requisitos de seguridad.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar la contraseña.');
      }

      setSuccessMessage(
        '¡Contraseña cambiada exitosamente! Se generó una nueva clave criptográfica y se invalidaron todas las sesiones anteriores.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cambiar contraseña.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (
      !confirm(
        '¿Confirmás que querés cerrar todas las demás sesiones activas en otros navegadores y dispositivos?'
      )
    ) {
      return;
    }

    setRevokingSessions(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/revoke-sessions', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudieron revocar las sesiones.');
      }

      setSuccessMessage(
        'Se han cerrado e invalidado exitosamente todas las demás sesiones activas.'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al revocar sesiones.');
    } finally {
      setRevokingSessions(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      {/* Cabecera */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-300">
          <KeyRound className="h-3.5 w-3.5" />
          <span>Gestión de Seguridad & Credenciales</span>
        </div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
          Mi Cuenta de Superadministrador
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Consultá los datos de tu cuenta, actualizá tu contraseña con hash bcrypt seguro y gestioná tus sesiones activas.
        </p>
      </div>

      {/* Tarjeta de Información de la Cuenta */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#131623] to-[#0A0D16] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00F0FF]/40 bg-[#00F0FF]/15 text-[#00F0FF] shadow-[0_0_24px_rgba(0,240,255,0.25)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-white">
                  {profile?.fullName || 'Superadministrador'}
                </h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-300">
                  {profile?.status || 'ACTIVO'}
                </span>
              </div>
              <p className="text-xs text-[#00F0FF] font-mono mt-0.5">
                {profile?.email || 'xjoacovidal@gmail.com'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
              Rol: <strong className="text-white">SUPERADMIN</strong>
            </span>
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300">
              Autenticación: <strong className="text-white">Bcrypt 12 Rounds</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Tarjeta de Cambio de Contraseña */}
      <div className="rounded-3xl border border-white/10 bg-[#090B12] p-6 sm:p-8">
        <div className="mb-6 border-b border-white/10 pb-4">
          <h2 className="text-lg font-black text-white">Cambiar mi contraseña</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingresá tu contraseña actual para verificar tu identidad y configurá una nueva clave robusta.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-semibold text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs font-semibold text-emerald-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-5">
          {/* Contraseña Actual */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
              Contraseña Actual *
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Ingresá tu contraseña actual"
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-4 pr-11 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Ocultar contraseña' : 'Ver contraseña'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Nueva Contraseña */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Nueva Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 10 caracteres"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-4 pr-11 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Confirmar Nueva Contraseña *
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Repetí la nueva contraseña"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-4 pr-11 text-xs text-white placeholder-slate-500 focus:border-[#00F0FF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Validador Visual de Fortaleza de Contraseña */}
          {newPassword && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Fortaleza de la contraseña:</span>
                <span
                  className={`font-black uppercase tracking-wider ${
                    strength.score <= 1
                      ? 'text-rose-400'
                      : strength.score === 2
                      ? 'text-amber-400'
                      : strength.score === 3
                      ? 'text-blue-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {strength.score <= 1
                    ? 'Débil'
                    : strength.score === 2
                    ? 'Media'
                    : strength.score === 3
                    ? 'Buena'
                    : 'Excelente'}
                </span>
              </div>

              {/* Barra de progreso de fortaleza */}
              <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full flex-1 rounded-full ${
                    strength.score >= 1 ? 'bg-rose-500' : 'bg-transparent'
                  }`}
                />
                <div
                  className={`h-full flex-1 rounded-full ${
                    strength.score >= 2 ? 'bg-amber-400' : 'bg-transparent'
                  }`}
                />
                <div
                  className={`h-full flex-1 rounded-full ${
                    strength.score >= 3 ? 'bg-blue-400' : 'bg-transparent'
                  }`}
                />
                <div
                  className={`h-full flex-1 rounded-full ${
                    strength.score >= 4 ? 'bg-emerald-400' : 'bg-transparent'
                  }`}
                />
              </div>

              {/* Requisitos mínimos */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
                <span className={newPassword.length >= 10 ? 'text-emerald-400 font-bold' : ''}>
                  ✓ Mínimo 10 caracteres
                </span>
                <span
                  className={
                    /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)
                      ? 'text-emerald-400 font-bold'
                      : ''
                  }
                >
                  ✓ Mayúsculas y minúsculas
                </span>
                <span className={/[0-9]/.test(newPassword) ? 'text-emerald-400 font-bold' : ''}>
                  ✓ Al menos un número
                </span>
                <span
                  className={
                    /[^A-Za-z0-9]/.test(newPassword) ? 'text-emerald-400 font-bold' : ''
                  }
                >
                  ✓ Al menos un símbolo (!@#$)
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#E02454] px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_20px_rgba(255,46,99,0.4)] hover:brightness-110 disabled:opacity-60 transition-all"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Actualizando clave...</span>
                </>
              ) : (
                <span>Actualizar Contraseña</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tarjeta de Gestión de Sesiones Activas */}
      <div className="rounded-3xl border border-white/10 bg-[#090B12] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-white sm:text-lg">
              Cerrar todas las demás sesiones
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              Si sospechás que dejaste tu cuenta abierta en otra computadora o celular, podés invalidar todas las demás sesiones activas. Tu sesión actual en este navegador permanecerá abierta.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRevokeAllSessions}
            disabled={revokingSessions}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 shrink-0 transition-colors"
          >
            {revokingSessions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span>Cerrar las demás sesiones</span>
          </button>
        </div>
      </div>
    </div>
  );
}
