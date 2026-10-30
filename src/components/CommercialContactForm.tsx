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
      // Limpiamos los campos
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
      <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-black/60 p-8 text-center backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.15)] animate-in zoom-in-95">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-4 shadow-[0_0_24px_rgba(16,185,129,0.3)]">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <span className="inline-block rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-black tracking-widest text-emerald-300 uppercase mb-2">
          Consulta recibida
        </span>
        <h3 className="text-2xl font-black text-white sm:text-3xl">
          ¡Gracias por tu interés en BarraOnline!
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-300 leading-relaxed">
          Recibimos los datos de tu establecimiento. Un asesor comercial especializado se pondrá en contacto por WhatsApp o correo en las próximas horas.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setStatus('IDLE')}
            className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-xs font-extrabold text-slate-200 uppercase hover:bg-white/10 transition"
          >
            Enviar otra consulta
          </button>
          <a
            href="https://wa.me/5492236237874?text=Hola,%20acabo%20de%20enviar%20el%20formulario%20de%20BarraOnline%20y%20me%20gustar%C3%ADa%20hacer%20una%20consulta%20directa."
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-black text-slate-950 uppercase hover:bg-emerald-400 transition shadow-[0_0_20px_rgba(16,185,129,0.4)]"
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
      className="overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#101424]/90 via-[#0B0D18]/90 to-[#07080E]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-9 space-y-4"
    >
      <div className="mb-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/30 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black tracking-widest text-[#00F0FF] uppercase mb-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Solicitud de Demostración y Tarifas</span>
        </div>
        <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
          Conocé cómo sumar BarraOnline a tu boliche
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Completá tus datos y te enviaremos una propuesta adaptada a la escala y capacidad de tu establecimiento.
        </p>
      </div>

      {status === 'ERROR' && errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-200 animate-in fade-in"
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
            className="mb-1 block text-xs font-bold text-slate-300"
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
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#00F0FF] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>

        {/* Nombre del Boliche */}
        <div>
          <label
            htmlFor="lead-venue-name"
            className="mb-1 block text-xs font-bold text-slate-300"
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
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#00F0FF] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* Ciudad */}
        <div>
          <label
            htmlFor="lead-city"
            className="mb-1 block text-xs font-bold text-slate-300"
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
              placeholder="Ej: Mar del Plata / CABA / Rosario"
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#00F0FF] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>

        {/* Cargo / Relación */}
        <div>
          <label
            htmlFor="lead-role"
            className="mb-1 block text-xs font-bold text-slate-300"
          >
            Cargo o relación con el local *
          </label>
          <select
            id="lead-role"
            value={roleInVenue}
            onChange={(e) => setRoleInVenue(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#141624] py-2.5 px-3.5 text-xs text-white transition-all focus:border-[#00F0FF] focus:outline-none"
          >
            <option value="Dueño / Propietario">Dueño / Propietario</option>
            <option value="Socio / Directivo">Socio / Directivo</option>
            <option value="Gerente / Encargado General">Gerente / Encargado General</option>
            <option value="Jefe de Barra / Operaciones">Jefe de Barra / Operaciones</option>
            <option value="Responsable de Marketing">Responsable de Marketing</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        {/* WhatsApp o Teléfono */}
        <div>
          <label
            htmlFor="lead-phone"
            className="mb-1 block text-xs font-bold text-slate-300"
          >
            WhatsApp o teléfono de contacto *
          </label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 223 555-0123"
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF2E63] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="lead-email"
            className="mb-1 block text-xs font-bold text-slate-300"
          >
            Correo electrónico *
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="lead-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marcos@tuboliche.com"
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#FF2E63] focus:bg-white/10 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mensaje Opcional */}
      <div>
        <label
          htmlFor="lead-message"
          className="mb-1 block text-xs font-bold text-slate-300"
        >
          Mensaje o consulta específica (opcional)
        </label>
        <div className="relative">
          <MessageSquare className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" />
          <textarea
            id="lead-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Contanos cuántas barras tenés o qué te gustaría mejorar en tu establecimiento..."
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2.5 pr-4 pl-10 text-xs text-white placeholder-slate-500 transition-all focus:border-[#00F0FF] focus:bg-white/10 focus:outline-none resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bo-btn-laser flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF2E63] py-4 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_35px_rgba(255,46,99,0.55)] transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Enviando consulta comercial...</span>
          </>
        ) : (
          <>
            <span>Quiero conocer BarraOnline</span>
            <Send className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-slate-500">
        Información comercial confidencial. Sin spam ni compromisos de permanencia.
      </p>
    </form>
  );
}
