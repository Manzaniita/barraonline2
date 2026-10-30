'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, X } from 'lucide-react';

export interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
  onSuccess?: () => void;
}

export function LogoutModal({
  isOpen,
  onClose,
  redirectTo,
  onSuccess,
}: LogoutModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectTo }),
      });

      const data = await res.json().catch(() => ({}));

      if (onSuccess) {
        onSuccess();
      }

      const target = data.redirectTo || redirectTo || window.location.pathname;

      if (target === window.location.pathname) {
        window.location.reload();
      } else {
        window.location.href = target;
      }
    } catch {
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/[0.12] bg-gradient-to-b from-[#121422] to-[#080911] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200">
        {/* Botón cerrar X */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar ventana"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-colors hover:border-white/[0.16] hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#FF007A]/30 bg-[#FF007A]/15 text-[#FF007A]">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <h3
              id="logout-modal-title"
              className="font-display text-base font-bold tracking-tight text-white sm:text-lg"
            >
              ¿Querés cerrar tu sesión?
            </h3>
            <p className="text-xs text-slate-400">
              Podrás volver a ingresar en cualquier momento.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bo-btn-laser inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF007A] px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,122,0.35)] hover:bg-[#FF1A8C] disabled:opacity-60 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Cerrando...</span>
              </>
            ) : (
              <span>Cerrar sesión</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
