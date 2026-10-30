'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

const WHATSAPP_URL =
  'https://wa.me/5492236237874?text=' +
  encodeURIComponent(
    'Hola, quiero conocer BarraOnline para mi boliche. Me gustaría recibir información y saber cómo puedo incorporarlo a mi establecimiento.'
  );

export function FloatingWhatsAppButton() {
  return (
    <aside aria-label="Contacto por WhatsApp" className="fixed bottom-5 right-5 z-30 sm:bottom-6 sm:right-6">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar con un asesor comercial de BarraOnline por WhatsApp"
        className="group relative flex items-center gap-3 rounded-full border border-emerald-400/40 bg-emerald-950/85 px-4 py-3 text-white backdrop-blur-xl shadow-[0_10px_35px_rgba(16,185,129,0.35)] transition-all duration-300 hover:scale-105 hover:border-emerald-400 hover:bg-emerald-900/90 active:scale-95"
      >
        {/* Glow animado */}
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full bg-emerald-500/25 blur-md transition-opacity group-hover:opacity-100"
        />

        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-[0_0_15px_#10B981]">
          <MessageCircle className="h-5 w-5 fill-slate-950" />
          <span className="absolute top-0 right-0 h-2.5 w-2.5 animate-ping rounded-full bg-emerald-200" />
          <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-100" />
        </div>

        <div className="hidden flex-col pr-1 text-left sm:flex">
          <span className="text-[10px] font-black tracking-widest text-emerald-300 uppercase leading-tight">
            Asesor comercial
          </span>
          <span className="text-xs font-black tracking-wide text-white leading-tight">
            Consultar por WhatsApp
          </span>
        </div>
      </a>
    </aside>
  );
}
