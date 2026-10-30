'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas. Comprobá tu correo y contraseña.');
      }

      router.push('/admin');
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al intentar iniciar sesión. Por favor reintentá.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#040407] px-4 py-12 text-slate-100 selection:bg-[#FF2E63] selection:text-white sm:px-6">
      {/* Luces y Grid de Fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="bo-stage-grid absolute inset-0 opacity-40" />
        <div className="absolute -top-32 left-1/2 h-[26rem] w-[40rem] -translate-x-1/2 rounded-full bg-[#00F0FF]/10 blur-3xl" />
        <div className="absolute -bottom-32 right-10 h-80 w-80 rounded-full bg-[#FF2E63]/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Cabecera / Identidad */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block transition-transform hover:scale-105">
            <img
              src="/logo-barraonline.png"
              alt="BarraOnline"
              className="mx-auto h-12 w-auto object-contain drop-shadow-[0_0_24px_rgba(0,240,255,0.4)] sm:h-14"
            />
          </Link>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black tracking-widest text-[#00F0FF] uppercase">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SaaS Control Center</span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Acceso administrativo
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Ingresá con tus credenciales seguras de superadministrador.
          </p>
        </div>

        {/* Tarjeta de Login */}
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#141624]/95 to-[#0A0B13]/95 p-7 shadow-[0_24px_70px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-9">
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs font-semibold text-rose-200 animate-in fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Correo */}
            <div className="space-y-2">
              <label
                htmlFor="email-input"
                className="block text-xs font-extrabold uppercase tracking-wider text-slate-300"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="xjoacovidal@gmail.com"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#00F0FF] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#00F0FF]"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div className="space-y-2">
              <label
                htmlFor="password-input"
                className="block text-xs font-extrabold uppercase tracking-wider text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-11 text-sm text-white placeholder-slate-500 transition-colors focus:border-[#00F0FF] focus:bg-white/[0.08] focus:outline-none focus:ring-1 focus:ring-[#00F0FF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botón Iniciar Sesión */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#E02454] px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-[0_0_24px_rgba(255,46,99,0.45)] transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Iniciar sesión</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ← Volver al sitio público de BarraOnline
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Acceso protegido con cifrado de grado militar, auditoría transaccional y limitación de intentos.
        </p>
      </div>
    </div>
  );
}
