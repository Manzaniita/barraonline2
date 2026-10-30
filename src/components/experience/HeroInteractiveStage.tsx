'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { formatArsFromCents } from '@/lib/format';

interface HeroDrinkItem {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
  priceCents: number;
  accent: string;
  glassType: 'TUMBLER' | 'GOBLET' | 'BOTTLE';
}

const HERO_DRINKS: HeroDrinkItem[] = [
  {
    id: 'fernet-xl',
    name: 'Fernet Branca + Coca XL',
    subtitle: 'Vaso 750ml • Hielo rolito • 30/70',
    tag: 'MÁS PEDIDO EN PISTA',
    priceCents: 1200000,
    accent: '#FF2E63',
    glassType: 'TUMBLER',
  },
  {
    id: 'gin-pink',
    name: 'Gin Tonic Pink & Pomelo',
    subtitle: 'Doble medida • Tónica helada',
    tag: 'REFRESCANTE',
    priceCents: 1550000,
    accent: '#00F0FF',
    glassType: 'GOBLET',
  },
  {
    id: 'combo-vip',
    name: 'Combo Absolut + 4 Speed',
    subtitle: 'Botella 700ml + Frapera hielo',
    tag: 'COMBO GRUPO',
    priceCents: 8500000,
    accent: '#A855F7',
    glassType: 'BOTTLE',
  },
];

type StageStep = 'SELECT' | 'PAY' | 'QR_READY';

export function HeroInteractiveStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<StageStep>('SELECT');
  const [selectedDrinkIdx, setSelectedDrinkIdx] = useState(0);
  const [qty, setQty] = useState(2);
  const [userInteracted, setUserInteracted] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 30 });

  const activeDrink = HERO_DRINKS[selectedDrinkIdx] ?? HERO_DRINKS[0]!;
  const totalCents = activeDrink.priceCents * qty;

  // Ciclo automático elegante mientras el visitante observa la escena
  useEffect(() => {
    if (userInteracted) return;
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) return;

    const timer = window.setInterval(() => {
      setStep((prev) => {
        if (prev === 'SELECT') return 'PAY';
        if (prev === 'PAY') return 'QR_READY';
        return 'SELECT';
      });
    }, 3800);

    return () => window.clearInterval(timer);
  }, [userInteracted]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const rotateY = (relX - 0.5) * 14;
    const rotateX = (0.5 - relY) * 12;

    setTilt({
      rotateX,
      rotateY,
      glareX: relX * 100,
      glareY: relY * 100,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 30 });
  };

  const selectStepManually = (next: StageStep) => {
    setUserInteracted(true);
    setStep(next);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="bo-perspective-stage relative mx-auto w-full max-w-lg select-none pt-4 pb-6 lg:max-w-none"
    >
      {/* Halo cromático trasero del escenario */}
      <div
        aria-hidden="true"
        className="animate-bo-pulse-glow pointer-events-none absolute -inset-6 rounded-[3rem] opacity-70 blur-3xl transition-colors duration-700"
        style={{
          background:
            step === 'QR_READY'
              ? 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.28), rgba(0,240,255,0.18), transparent 70%)'
              : step === 'PAY'
                ? 'radial-gradient(circle at 50% 50%, rgba(0,240,255,0.28), rgba(255,46,99,0.18), transparent 70%)'
                : 'radial-gradient(circle at 50% 50%, rgba(255,46,99,0.28), rgba(168,85,247,0.2), transparent 70%)',
        }}
      />

      {/* Anillo Orbital de Frecuencia Acústica (SVG animado en plano profundo) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-8 -right-8 hidden h-56 w-56 opacity-45 sm:block"
      >
        <svg
          viewBox="0 0 200 200"
          className="animate-bo-spin-slow h-full w-full text-[#00F0FF]"
        >
          <defs>
            <linearGradient id="boRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF2E63" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#00F0FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="84"
            fill="none"
            stroke="url(#boRingGrad)"
            strokeWidth="1.5"
            strokeDasharray="8 10"
          />
          <circle
            cx="100"
            cy="100"
            r="66"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
            strokeDasharray="3 8"
          />
        </svg>
      </div>

      {/* Contenedor 3D con Inclinación Reactiva */}
      <div
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="bo-preserve-3d relative"
      >
        {/* SATÉLITE FLOTANTE SUPERIOR DERECHO: Pulso Acústico de Pista */}
        <div
          style={{ transform: 'translateZ(42px)' }}
          className="bo-glass-pill animate-bo-float absolute -top-5 right-3 z-20 flex items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs shadow-2xl sm:-right-4"
        >
          <div className="flex h-4 items-end gap-0.5">
            <span className="animate-bo-eq-1 h-3.5 w-1 rounded-full bg-[#FF2E63]" />
            <span className="animate-bo-eq-2 h-4 w-1 rounded-full bg-[#00F0FF]" />
            <span className="animate-bo-eq-3 h-3 w-1 rounded-full bg-[#FF2E63]" />
            <span className="animate-bo-eq-2 h-3.5 w-1 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] font-black tracking-widest text-white uppercase">
              PISTA EN VIVO
            </div>
            <div className="text-[10px] font-medium text-slate-400">
              Pedís sin dejar de bailar
            </div>
          </div>
        </div>

        {/* SATÉLITE FLOTANTE INFERIOR IZQUIERDO: Indicador Cero Filas */}
        <div
          style={{ transform: 'translateZ(48px)' }}
          className="bo-glass-pill animate-bo-float-reverse absolute -bottom-5 left-3 z-20 flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs shadow-2xl sm:-left-5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-black tracking-wide text-white uppercase">
              0 MIN DE FILA EN CAJA
            </div>
            <div className="text-[10px] text-emerald-300">
              Stock reservado al instante
            </div>
          </div>
        </div>

        {/* TARJETA CENTRAL HOLOGRÁFICA DEL ESCENARIO */}
        <div className="bo-glass-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
          {/* Brillo especular reactivo al puntero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300"
            style={{
              background: `radial-gradient(420px circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.12), transparent 60%)`,
            }}
          />

          {/* Cabecera del Simulador en Vivo + Selector de 3 Fases */}
          <div className="relative z-10 flex flex-col gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2E63] opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF2E63]" />
                </span>
                <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase">
                  DEMO INTERACTIVA EN VIVO
                </span>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-[#00F0FF]">
                Tocá para probar
              </span>
            </div>

            {/* Navegador de Pasos del Pedido */}
            <div
              role="tablist"
              aria-label="Pasos de la experiencia BarraOnline"
              className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/50 p-1.5 border border-white/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={step === 'SELECT'}
                onClick={() => selectStepManually('SELECT')}
                className={`rounded-xl py-2 px-2 text-[11px] font-black tracking-wide uppercase transition-all ${
                  step === 'SELECT'
                    ? 'bg-[#FF2E63] text-white shadow-[0_0_20px_rgba(255,46,99,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Elegir Trago
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={step === 'PAY'}
                onClick={() => selectStepManually('PAY')}
                className={`rounded-xl py-2 px-2 text-[11px] font-black tracking-wide uppercase transition-all ${
                  step === 'PAY'
                    ? 'bg-[#00F0FF] text-[#070709] shadow-[0_0_20px_rgba(0,240,255,0.45)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Pagar MP
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={step === 'QR_READY'}
                onClick={() => selectStepManually('QR_READY')}
                className={`rounded-xl py-2 px-2 text-[11px] font-black tracking-wide uppercase transition-all ${
                  step === 'QR_READY'
                    ? 'bg-emerald-400 text-[#070709] shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Retirar QR
              </button>
            </div>
          </div>

          {/* ESCENA 1: ELEGIR TRAGO EN LA PISTA */}
          {step === 'SELECT' && (
            <div className="relative z-10 mt-4 space-y-4">
              {/* Selector rápido de bebida */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {HERO_DRINKS.map((drink, idx) => {
                  const isSelected = idx === selectedDrinkIdx;
                  return (
                    <button
                      key={drink.id}
                      type="button"
                      onClick={() => {
                        setUserInteracted(true);
                        setSelectedDrinkIdx(idx);
                      }}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-all ${
                        isSelected
                          ? 'border-white/30 bg-white/12 text-white shadow-lg'
                          : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div
                        className="text-[9px] font-black tracking-wider uppercase"
                        style={{ color: drink.accent }}
                      >
                        {drink.tag}
                      </div>
                      <div className="mt-0.5 text-xs font-extrabold">
                        {drink.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Tarjeta Principal del Trago Seleccionado con Arte Vectorial Luminoso */}
              <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#161926] to-[#0B0D14] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <span
                      style={{
                        backgroundColor: `${activeDrink.accent}22`,
                        color: activeDrink.accent,
                        borderColor: `${activeDrink.accent}55`,
                      }}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase"
                    >
                      <Sparkles className="h-3 w-3" />
                      {activeDrink.tag}
                    </span>
                    <h3 className="text-lg font-black text-white sm:text-xl">
                      {activeDrink.name}
                    </h3>
                    <p className="text-xs text-slate-400">{activeDrink.subtitle}</p>
                  </div>

                  {/* Ilustración SVG de Vaso / Botella Iluminada */}
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 shadow-inner"
                    style={{
                      boxShadow: `0 0 28px ${activeDrink.accent}33`,
                    }}
                  >
                    <svg
                      viewBox="0 0 64 64"
                      className="h-11 w-11"
                      fill="none"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient
                          id="drinkGlow"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="100%"
                        >
                          <stop offset="0%" stopColor={activeDrink.accent} />
                          <stop offset="100%" stopColor="#00F0FF" />
                        </linearGradient>
                      </defs>
                      {/* Vaso nocturno estilizado con cubos de hielo y sorbete */}
                      <path
                        d="M16 14H48L44 54C43.8 56.2 42 58 39.8 58H24.2C22 58 20.2 56.2 20 54L16 14Z"
                        stroke="url(#drinkGlow)"
                        strokeWidth="2.5"
                        fill="rgba(255,255,255,0.03)"
                      />
                      <path
                        d="M18 26C24 28 28 24 34 26C40 28 43 25 46 26L44 53H20L18 26Z"
                        fill="url(#drinkGlow)"
                        fillOpacity="0.35"
                      />
                      <rect
                        x="24"
                        y="29"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="#FFFFFF"
                        strokeOpacity="0.7"
                        strokeWidth="1.5"
                      />
                      <rect
                        x="33"
                        y="35"
                        width="7"
                        height="7"
                        rx="1.5"
                        stroke="#FFFFFF"
                        strokeOpacity="0.7"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M36 52L43 8L49 6"
                        stroke="#00F0FF"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                {/* Controles interactivos de cantidad y subtotal */}
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3.5">
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      Total de tu pedido ({qty} {qty === 1 ? 'unidad' : 'unidades'})
                    </div>
                    <div className="tabular-nums text-2xl font-black text-white">
                      {formatArsFromCents(totalCents)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Disminuir cantidad en demostración"
                      onClick={() => {
                        setUserInteracted(true);
                        setQty((q) => Math.max(1, q - 1));
                      }}
                      className="bo-gpu-transition flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="tabular-nums w-6 text-center text-base font-black text-white">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Aumentar cantidad en demostración"
                      onClick={() => {
                        setUserInteracted(true);
                        setQty((q) => Math.min(6, q + 1));
                      }}
                      style={{ backgroundColor: activeDrink.accent }}
                      className="bo-gpu-transition flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Acción para pasar a Pago Instantáneo */}
              <button
                type="button"
                onClick={() => selectStepManually('PAY')}
                className="bo-btn-laser flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#FF2E63] via-[#FF1E7A] to-[#D91B5C] px-5 py-3.5 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_28px_rgba(255,46,99,0.45)]"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Reservar Stock y Pagar con Mercado Pago
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ESCENA 2: PAGO INSTANTÁNEO Y RESERVA DE STOCK */}
          {step === 'PAY' && (
            <div className="relative z-10 mt-4 space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-[#00F0FF]/40 bg-gradient-to-b from-[#0C1D29] to-[#0B0E17] p-5 text-center">
                {/* Ondas concéntricas de confirmación */}
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#00F0FF]/25" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00F0FF] text-[#070709] shadow-[0_0_30px_rgba(0,240,255,0.6)]">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#00F0FF]/15 px-3 py-0.5 text-[10px] font-black tracking-widest text-[#00F0FF] uppercase">
                  STOCK BLOQUEADO PARA VOS
                </div>

                <h3 className="mt-2 text-lg font-black text-white">
                  {qty}x {activeDrink.name}
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  Pagás en un toque desde tu celular con{' '}
                  <strong className="text-white">Mercado Pago</strong>. Tus bebidas ya
                  están separadas en barra.
                </p>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs">
                  <span className="text-slate-400">Total confirmado</span>
                  <span className="tabular-nums text-base font-black text-[#00F0FF]">
                    {formatArsFromCents(totalCents)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => selectStepManually('QR_READY')}
                className="bo-btn-laser flex w-full items-center justify-between rounded-2xl bg-[#00F0FF] px-5 py-3.5 text-xs font-black tracking-wider text-[#070709] uppercase shadow-[0_0_28px_rgba(0,240,255,0.45)]"
              >
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Ver mi Código QR de Retiro Exprés
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ESCENA 3: PASE QR ÓPTICO CON ESCÁNER LÁSER EN BARRA */}
          {step === 'QR_READY' && (
            <div className="relative z-10 mt-4 space-y-4">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/45 bg-gradient-to-b from-emerald-950/50 to-[#0B0E17] p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-black text-[#070709] uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    PAGO APROBADO • QR ACTIVO
                  </span>
                  <span className="font-mono text-xs font-black text-emerald-300">
                    #BO-8492
                  </span>
                </div>

                <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                  {/* QR de Alto Contraste con Haz de Escaneo Láser */}
                  <div className="relative shrink-0 overflow-hidden rounded-2xl bg-white p-3 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
                    {/* Haz de escaneo láser animado */}
                    <div
                      aria-hidden="true"
                      className="animate-bo-laser-scan pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-transparent via-[#FF2E63]/60 to-[#FF2E63] shadow-[0_0_12px_#FF2E63]"
                    />
                    <svg
                      viewBox="0 0 100 100"
                      className="h-24 w-24 text-[#070709]"
                      fill="currentColor"
                      role="img"
                      aria-label="Código QR de demostración"
                    >
                      <path d="M8 8h28v28H8V8zm6 6v16h16V14H14zm50-6h28v28H64V8zm6 6v16h16V14H70zM8 64h28v28H8V64zm6 6v16h16V70H14zm4-52h8v8h-8v-8zm52 0h8v8h-8v-8zM18 74h8v8h-8v-8zm26-66h8v14h-8V8zm10 14h6v14h-6V22zM44 44h12v12H44V44zm-28 0h14v8H16v-8zm56 0h20v8H72v-8zM44 64h8v28h-8V64zm16 8h14v8H60v-8zm16 12h16v8H76v-8zm-16 0h8v8h-8v-8zm20-20h12v8H80v-8z" />
                    </svg>
                  </div>

                  <div className="space-y-1.5 text-center sm:text-left">
                    <div className="text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
                      Mostralo en barra y retirá
                    </div>
                    <h3 className="text-base font-black text-white">
                      {qty}x {activeDrink.name}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      El barman escanea tu pantalla en{' '}
                      <strong className="text-white">menos de 2 segundos</strong> y te
                      entrega tu pedido sin tocar efectivo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => selectStepManually('SELECT')}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  Probar con otro trago
                </button>
                <a
                  href="#boliches"
                  className="bo-btn-laser inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-[#070709] uppercase shadow-lg"
                >
                  Pedir en mi boliche
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
