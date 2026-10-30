'use client';

import React, { useState } from 'react';
import {
  Check,
  Palette,
  Store,
} from 'lucide-react';
import { formatArsFromCents } from '@/lib/format';

interface BrandPreset {
  id: string;
  name: string;
  city: string;
  tagline: string;
  badge: string;
  accentPrimary: string;
  accentSecondary: string;
  bgGradient: string;
  category: string;
  featuredDrink: {
    name: string;
    description: string;
    priceCents: number;
    promoTag: string;
  };
}

const BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'museum',
    name: 'Museum Ocean Club',
    city: 'Mar del Plata • Playa Grande',
    tagline: 'Main Stage & Terraza Frente al Mar',
    badge: 'TEMPORADA 2026',
    accentPrimary: '#FF007A',
    accentSecondary: '#00F0FF',
    bgGradient: 'from-[#160c18] via-[#0d0f1a] to-[#090b12]',
    category: 'Tragos & Medidas XL',
    featuredDrink: {
      name: 'Fernet Branca + Coca-Cola XL (750ml)',
      description: 'Vaso rígido reusable con hielo rolito y proporción clásica.',
      priceCents: 1200000,
      promoTag: 'PROMO PISTA',
    },
  },
  {
    id: 'pueblo',
    name: 'Pueblo Límite',
    city: 'Villa Gesell • Complejo Megadisco',
    tagline: '4 Pistas, 8 Barras Rápidas',
    badge: 'ACCESO EXPRÉS',
    accentPrimary: '#00F5D4',
    accentSecondary: '#A855F7',
    bgGradient: 'from-[#061715] via-[#0d0c1c] to-[#080912]',
    category: 'Combos Botella Pista',
    featuredDrink: {
      name: 'Combo Smirnoff Red + 4 Speed XL',
      description: 'Botella 700ml con 4 energizantes Speed y frapera con hielo.',
      priceCents: 6900000,
      promoTag: 'COMBO VIP',
    },
  },
  {
    id: 'custom',
    name: 'Tu Boliche Aquí',
    city: 'Tu Ciudad • Tu Escenario',
    tagline: 'Tu propia carta digital sin intermediarios',
    badge: 'MARCA PROPIA',
    accentPrimary: '#F59E0B',
    accentSecondary: '#EC4899',
    bgGradient: 'from-[#171107] via-[#120a16] to-[#080912]',
    category: 'Especialidades de la Casa',
    featuredDrink: {
      name: 'Cocktail Signature de Autor',
      description: 'Creá tus propias categorías, fotos de tragos y precios a medida.',
      priceCents: 1600000,
      promoTag: 'EXCLUSIVO APP',
    },
  },
];

export function BrandIdentityShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeBrand = BRAND_PRESETS[activeIdx] ?? BRAND_PRESETS[0]!;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-12">
      {/* Columna Izquierda: Explicación Comercial de Marca Blanca */}
      <div className="space-y-6 lg:col-span-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1 text-xs font-semibold text-[#00F0FF]">
          <Palette className="h-3.5 w-3.5" />
          <span>Marca Blanca Total</span>
        </div>

        <h3 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Tu boliche al frente. Tu identidad en cada pantalla.
        </h3>

        <p className="text-sm sm:text-base leading-relaxed text-slate-300">
          Tus clientes nunca ven una aplicación genérica de terceros. Entran a una experiencia digital personalizada con los colores, el logo, las promociones y el estilo visual de tu establecimiento.
        </p>

        {/* Selector de Presets de Demostración */}
        <div className="space-y-2.5 pt-2">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Probá cómo se adapta la experiencia:
          </span>
          <div className="flex flex-wrap gap-2.5">
            {BRAND_PRESETS.map((preset, idx) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                  activeIdx === idx
                    ? 'border-white bg-white text-slate-950 font-bold shadow-md scale-[1.02]'
                    : 'border-white/[0.1] bg-white/[0.03] text-slate-300 hover:border-white/[0.2] hover:bg-white/[0.06]'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: preset.accentPrimary }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pilares Clave */}
        <div className="grid gap-3 pt-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Check className="h-4 w-4 text-[#00F0FF]" />
              <span>Sin apps obligatorias</span>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-snug">
              Tus clientes ingresan directo desde el navegador escaneando un código QR en el local.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Check className="h-4 w-4 text-[#FF007A]" />
              <span>Cobro en tu cuenta</span>
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-snug">
              Cada peso cobrado ingresa en tiempo real a tu cuenta de Mercado Pago vinculada.
            </p>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Mockup de la Carta Personalizada */}
      <div className="lg:col-span-6">
        <div
          className={`relative overflow-hidden rounded-[2.25rem] border border-white/[0.12] bg-gradient-to-br ${activeBrand.bgGradient} p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.85)] transition-all duration-300`}
        >
          <div className="relative z-10 space-y-5">
            {/* Header del Boliche */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: `${activeBrand.accentPrimary}18`,
                    color: activeBrand.accentPrimary,
                    borderColor: `${activeBrand.accentPrimary}40`,
                    borderWidth: '1px',
                  }}
                >
                  {activeBrand.badge}
                </span>
                <h4 className="font-display mt-1 text-xl font-bold text-white">
                  {activeBrand.name}
                </h4>
                <p className="text-xs text-slate-300">{activeBrand.city}</p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-black/40">
                <Store className="h-5 w-5" style={{ color: activeBrand.accentPrimary }} />
              </div>
            </div>

            {/* Categorías Branded */}
            <div className="space-y-2">
              <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                Categorías personalizadas
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span
                  className="rounded-lg px-3 py-1 font-bold uppercase transition-all shadow-sm"
                  style={{
                    backgroundColor: activeBrand.accentPrimary,
                    color: '#070709',
                  }}
                >
                  {activeBrand.category}
                </span>
                <span className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-slate-300 uppercase">
                  Combos VIP
                </span>
                <span className="rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-slate-300 uppercase">
                  Cervezas
                </span>
              </div>
            </div>

            {/* Trago Destacado */}
            <div className="rounded-2xl border border-white/[0.1] bg-black/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-[9px] font-bold uppercase"
                    style={{
                      backgroundColor: `${activeBrand.accentPrimary}25`,
                      color: activeBrand.accentPrimary,
                    }}
                  >
                    {activeBrand.featuredDrink.promoTag}
                  </span>
                  <h5 className="font-display mt-1 text-base font-bold text-white">
                    {activeBrand.featuredDrink.name}
                  </h5>
                  <p className="text-xs text-slate-400">
                    {activeBrand.featuredDrink.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-display tabular-nums text-lg font-bold text-white">
                    {formatArsFromCents(activeBrand.featuredDrink.priceCents)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition-all shadow-md active:scale-95"
                style={{ backgroundColor: activeBrand.accentPrimary }}
              >
                Agregar al pedido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
