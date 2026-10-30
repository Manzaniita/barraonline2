'use client';

import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  GlassWater,
  Layers,
  Palette,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
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
    accentPrimary: '#FF2E63',
    accentSecondary: '#00F0FF',
    bgGradient: 'from-[#1A0A17] via-[#0F0C18] to-[#0A121F]',
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
    bgGradient: 'from-[#051A18] via-[#0D0B1C] to-[#12071F]',
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
    bgGradient: 'from-[#1A1205] via-[#140A18] to-[#0D0A14]',
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
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3.5 py-1 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
          <Palette className="h-3.5 w-3.5" />
          <span>Marca Blanca Total</span>
        </div>

        <h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Tu boliche al frente. Tu identidad en cada pantalla.
        </h3>

        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          Tus clientes nunca ven una aplicación genérica de terceros. Entran a una experiencia digital pensada con los colores, el logo, las promociones y el estilo visual de tu establecimiento.
        </p>

        {/* Selector de Presets de Demostración */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-black tracking-wider text-slate-400 uppercase">
            Probá cómo se adapta la experiencia:
          </span>
          <div className="flex flex-wrap gap-2.5">
            {BRAND_PRESETS.map((preset, idx) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs font-extrabold transition-all duration-300 ${
                  activeIdx === idx
                    ? 'border-white bg-white text-slate-950 shadow-[0_0_25px_rgba(255,255,255,0.4)] scale-105'
                    : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/10'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: preset.accentPrimary }}
                />
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pilares Clave */}
        <div className="grid gap-3 pt-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Check className="h-4 w-4 text-[#00F0FF]" />
              <span>Sin apps obligatorias</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Tus clientes ingresan directo desde el navegador escaneando un código QR en el local.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Check className="h-4 w-4 text-[#FF2E63]" />
              <span>Cobro en tu cuenta</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Cada peso cobrado ingresa en tiempo real a tu cuenta de Mercado Pago vinculada.
            </p>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Mockup Vivo de la Carta Personalizada */}
      <div className="lg:col-span-6">
        <div
          className={`relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-gradient-to-br ${activeBrand.bgGradient} p-6 sm:p-8 shadow-[0_30px_90px_rgba(0,0,0,0.9)] transition-all duration-500`}
        >
          {/* Acento de luz dinámico según el boliche */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-3xl opacity-30 transition-all duration-500"
            style={{ backgroundColor: activeBrand.accentPrimary }}
          />

          <div className="relative z-10 space-y-6">
            {/* Header de la Experiencia del Boliche */}
            <div className="flex items-start justify-between border-b border-white/15 pb-5">
              <div>
                <span
                  className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-widest uppercase transition-colors"
                  style={{
                    backgroundColor: `${activeBrand.accentPrimary}22`,
                    color: activeBrand.accentPrimary,
                    borderColor: `${activeBrand.accentPrimary}44`,
                    borderWidth: '1px',
                  }}
                >
                  {activeBrand.badge}
                </span>
                <h4 className="mt-1.5 text-2xl font-black text-white">
                  {activeBrand.name}
                </h4>
                <p className="text-xs text-slate-300">{activeBrand.city}</p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/40 backdrop-blur-md">
                <Store className="h-6 w-6" style={{ color: activeBrand.accentPrimary }} />
              </div>
            </div>

            {/* Simulación de Categorías Branded */}
            <div className="space-y-2">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">
                Categorías personalizadas
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-black scrollbar-none">
                <span
                  className="rounded-xl px-3.5 py-1.5 uppercase transition-all shadow-md"
                  style={{
                    backgroundColor: activeBrand.accentPrimary,
                    color: '#070709',
                  }}
                >
                  {activeBrand.category}
                </span>
                <span className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300 uppercase">
                  Combos VIP
                </span>
                <span className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-slate-300 uppercase">
                  Cervezas
                </span>
              </div>
            </div>

            {/* Tarjeta de Producto Branded en Vivo */}
            <div className="rounded-2xl border border-white/15 bg-black/50 p-4.5 backdrop-blur-md space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span
                    className="inline-block text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${activeBrand.accentSecondary}25`,
                      color: activeBrand.accentSecondary,
                    }}
                  >
                    {activeBrand.featuredDrink.promoTag}
                  </span>
                  <h5 className="text-base font-black text-white">
                    {activeBrand.featuredDrink.name}
                  </h5>
                  <p className="text-xs text-slate-300 leading-snug">
                    {activeBrand.featuredDrink.description}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-lg font-black text-white block">
                    {formatArsFromCents(activeBrand.featuredDrink.priceCents)}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    Stock en vivo ✓
                  </span>
                </div>
              </div>

              {/* Botón de compra rápido con el color del local */}
              <div className="pt-1 flex items-center justify-between border-t border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <QrCode className="h-3.5 w-3.5" style={{ color: activeBrand.accentPrimary }} />
                  <span>Retiro directo en barra</span>
                </div>

                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-xs font-black uppercase transition-all hover:scale-105 active:scale-95 shadow-lg"
                  style={{
                    backgroundColor: activeBrand.accentPrimary,
                    color: '#070709',
                  }}
                >
                  Pedir ahora
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>URL propia: <strong className="text-white">{activeBrand.id}.barraonline.com.ar</strong></span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Mercado Pago Conectado
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
