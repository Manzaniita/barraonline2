'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
  User,
} from 'lucide-react';

export function CommercialContactForm() {
  const [fullName, setFullName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [roleInVenue, setRoleInVenue] = useState('Dueño / Propietario');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          venueName,
          city,
          roleInVenue,
          phone,
          email,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || 'No se pudo enviar la solicitud. Por favor reintentá o comunicate por WhatsApp.'
        );
      }

      setStatus('SUCCESS');
      setFullName('');
      setVenueName('');
      setCity('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al enviar el formulario. Comprobá tu conexión.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (status === 'SUCCESS') {
    return (
      <div className="rounded-[2rem] border border-emerald-500/35 bg-[#091412]/90 p-8 text-center backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] animate-in zoom-in-95">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <span className="inline-block rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-bold tracking-wider text-emerald-300 uppercase mb-2">
          Consulta recibida
        </span>
        <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
          ¡Gracias por contactar a BarraOnline!
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-300 leading-relaxed">
          Recibimos los datos de tu establecimiento. Un asesor comercial especializado se pondrá en contacto en breve.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setStatus('IDLE')}
            className="rounded-xl border border-white/[0.15] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 uppercase hover:bg-white/[0.08] transition"
          >
            Enviar otra consulta
          </button>
          <a
            href="https://wa.me/5492236237874?text=Hola,%20acabo%20de%20enviar%20el%20formulario%20de%20BarraOnline%20y%20me%20gustar%C3%ADa%20hacer%20una%20consulta%20directa."
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400 transition"
          >
            Abrir chat directo
          </a>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0c0e18]/90 p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.8)] backdrop-blur-xl space-y-4"
    >
      <div className="mb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[11px] font-bold tracking-wider text-[#00F0FF] uppercase mb-2">
          <Sparkles className="h-3.5 w-3.5 text-[#FF007A]" />
          <span>Solicitud de Demostración</span>
        </div>
        <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
          Conocé cómo sumar BarraOnline a tu boliche
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Completá tus datos y te enviaremos una propuesta adaptada a la escala y capacidad de tu establecimiento.
        </p>
      </div>

      {status === 'ERROR' && errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-200 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Nombre y Apellido */}
        <div>
          <label
            htmlFor="lead-full-name"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            Nombre y apellido *
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-full-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Marcos Albornoz"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none"
            />
          </div>
        </div>

        {/* Nombre del Boliche */}
        <div>
          <label
            htmlFor="lead-venue-name"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            Nombre del boliche o bar *
          </label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-venue-name"
              type="text"
              required
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Ej: Club Costanera"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Ciudad */}
        <div>
          <label
            htmlFor="lead-city"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            Ciudad o localidad *
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-city"
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej: Mar del Plata / CABA"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none"
            />
          </div>
        </div>

        {/* Cargo */}
        <div>
          <label
            htmlFor="lead-role"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            Cargo en el local *
          </label>
          <select
            id="lead-role"
            value={roleInVenue}
            onChange={(e) => setRoleInVenue(e.target.value)}
            className="w-full rounded-xl border border-white/[0.1] bg-[#0c0e18] py-2.5 px-3.5 text-xs text-white transition-all focus:border-[#FF007A] focus:outline-none"
          >
            <option value="Dueño / Propietario">Dueño / Propietario</option>
            <option value="Gerente General / Operativo">Gerente General / Operativo</option>
            <option value="Jefe de Barra / Encargado">Jefe de Barra / Encargado</option>
            <option value="Socio / Inversor">Socio / Inversor</option>
            <option value="Otro">Otro rol</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* WhatsApp */}
        <div>
          <label
            htmlFor="lead-phone"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            WhatsApp de contacto *
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +54 9 223 123-4567"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none"
            />
          </div>
        </div>

        {/* Correo Electrónico */}
        <div>
          <label
            htmlFor="lead-email"
            className="mb-1 block text-xs font-semibold text-slate-300"
          >
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@tuboliche.com"
              className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mensaje */}
      <div>
        <label
          htmlFor="lead-message"
          className="mb-1 block text-xs font-semibold text-slate-300"
        >
          Contanos sobre tu local (opcional)
        </label>
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" />
          <textarea
            id="lead-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="¿Cuántas barras tenés? ¿Qué días abrís? ¿Cuál es tu mayor desafío operativo?"
            className="w-full rounded-xl border border-white/[0.1] bg-black/40 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF007A] focus:bg-white/[0.03] focus:outline-none resize-none"
          />
        </div>
      </div>

      {/* Botón Enviar */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bo-btn-laser inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF007A] py-3.5 text-xs font-bold tracking-wider text-white uppercase shadow-[0_0_24px_rgba(255,0,122,0.35)] transition-all hover:bg-[#FF1A8C] disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enviando solicitud...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Solicitar demostración para mi local</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
