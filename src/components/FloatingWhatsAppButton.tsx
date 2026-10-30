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
    <aside aria-label="Contacto por WhatsApp" className="fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar con un asesor comercial de BarraOnline por WhatsApp"
        className="group relative flex items-center gap-3 rounded-full border border-white/[0.12] bg-[#0c1312]/90 px-3.5 py-2.5 sm:px-4 sm:py-3 text-white backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-all duration-200 hover:scale-[1.03] hover:border-emerald-500/40 hover:bg-[#0f1a18] active:scale-95"
      >
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
          <MessageCircle className="h-4 w-4 fill-slate-950" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-emerald-200" />
        </div>

        <div className="hidden flex-col pr-1 text-left sm:flex">
          <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase leading-none">
            Asesor comercial
          </span>
          <span className="text-xs font-semibold text-white leading-tight mt-0.5">
            WhatsApp Directo
          </span>
        </div>
      </a>
    </aside>
  );
}
