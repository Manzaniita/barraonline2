'use client';

import React, { useEffect, useState } from 'react';
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
  X,
} from 'lucide-react';

interface UnifiedAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tenantSlug?: string | null;
  }) => void;
  initialTenantSlug?: string;
}

export function UnifiedAuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialTenantSlug,
}: UnifiedAuthModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Soporte para tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          tenantSlug: initialTenantSlug,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas. Comprobá tu correo y contraseña.');
      }

      if (onSuccess) {
        onSuccess(data.user);
      }

      onClose();

      // Redirección inteligente
      if (data.redirectUrl && data.redirectUrl !== window.location.pathname) {
        router.push(data.redirectUrl);
      }
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/[0.12] bg-gradient-to-b from-[#121422] via-[#0d0f18] to-[#080911] p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.95)] animate-in zoom-in-95 duration-200">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="absolute top-5 right-5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-colors hover:border-white/[0.16] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Cabecera unificada */}
        <div className="mb-6 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#00F0FF] uppercase">
            <ShieldCheck className="h-3 w-3" />
            <span>Acceso Seguro Unificado</span>
          </div>
          <h2
            id="unified-auth-modal-title"
            className="font-display text-2xl font-bold tracking-tight text-white"
          >
            Iniciar sesión
          </h2>
          <p className="text-xs text-slate-400">
            Ingresá a tu cuenta para continuar en BarraOnline.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-200 animate-in fade-in"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Opción 1: Acceso rápido con Google */}
          <div>
            <a
              href={`/api/auth/google/start?slug=${encodeURIComponent(
                initialTenantSlug || 'landing'
              )}`}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.2] bg-white px-4 py-3 text-xs font-bold text-slate-950 transition-all hover:bg-slate-100 shadow-sm active:scale-[0.99]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </a>
          </div>

          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" />
            <span className="absolute bg-[#0d0f18] px-3 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
              o con credenciales
            </span>
          </div>

          {/* Formulario unificado de credenciales */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="auth-email-input"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password-input"
                className="mb-1 block text-xs font-semibold text-slate-300"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-10 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bo-btn-laser mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF007A] py-3 text-xs font-bold tracking-wider text-white uppercase shadow-[0_0_22px_rgba(255,0,122,0.38)] transition-all hover:bg-[#FF1A8C] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Identificando cuenta...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
