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
  Wifi,
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
}

const HERO_DRINKS: HeroDrinkItem[] = [
  {
    id: 'fernet-xl',
    name: 'Fernet Branca + Cola XL',
    subtitle: 'Vaso 750ml • Hielo rolito • Proporción 30/70',
    tag: 'MÁS PEDIDO',
    priceCents: 1200000,
    accent: '#FF007A',
  },
  {
    id: 'gin-pink',
    name: 'Gin Tonic Pink & Pomelo',
    subtitle: 'Doble medida artesanal • Tónica premium',
    tag: 'FAVORITO',
    priceCents: 1550000,
    accent: '#FF2E63',
  },
  {
    id: 'combo-vip',
    name: 'Combo Absolut + 4 Speed',
    subtitle: 'Botella 700ml + Frapera con hielo',
    tag: 'COMBO PISTA',
    priceCents: 8500000,
    accent: '#00F0FF',
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

  // Ciclo automático suave que se detiene cuando el usuario interactúa
  useEffect(() => {
    if (userInteracted) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = window.setInterval(() => {
      setStep((prev) => {
        if (prev === 'SELECT') return 'PAY';
        if (prev === 'PAY') return 'QR_READY';
        return 'SELECT';
      });
    }, 4500);

    return () => window.clearInterval(timer);
  }, [userInteracted]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const rotateY = (relX - 0.5) * 8;
    const rotateX = (0.5 - relY) * 8;

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
      className="bo-perspective-stage relative mx-auto w-full max-w-lg select-none pt-2 pb-6 lg:max-w-none"
    >
      {/* Resplandor ambiental de profundidad suave bajo el dispositivo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 rounded-[2.5rem] opacity-30 blur-3xl transition-colors duration-700"
        style={{
          background:
            step === 'QR_READY'
              ? 'radial-gradient(circle at 50% 50%, rgba(16,185,129,0.22), transparent 70%)'
              : 'radial-gradient(circle at 50% 50%, rgba(255,0,122,0.22), transparent 70%)',
        }}
      />

      {/* Contenedor 3D con Inclinación Reactiva */}
      <div
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="bo-preserve-3d relative"
      >
        {/* Satélite Superior: Retiro en barra en segundos */}
        <div
          style={{ transform: 'translateZ(32px)' }}
          className="bo-glass-pill absolute -top-4 right-2 z-20 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs shadow-2xl sm:flex sm:-right-3"
        >
          <div className="flex h-2 w-2 rounded-full bg-[#FF007A] shadow-[0_0_8px_#FF007A]" />
          <div>
            <div className="text-[10px] font-bold tracking-widest text-white uppercase">
              SIN ESPERA EN PISTA
            </div>
            <div className="text-[10px] text-slate-400">
              Validación en 3 segundos
            </div>
          </div>
        </div>

        {/* Satélite Inferior: Cobro directo con Mercado Pago */}
        <div
          style={{ transform: 'translateZ(36px)' }}
          className="bo-glass-pill absolute -bottom-4 left-2 z-20 hidden items-center gap-2.5 rounded-2xl px-3.5 py-2 text-xs shadow-2xl sm:flex sm:-left-3"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-white uppercase">
              PAGO DIRECTO MERCADO PAGO
            </div>
            <div className="text-[10px] text-emerald-300">
              Acreditación inmediata
            </div>
          </div>
        </div>

        {/* Tarjeta Central: Simulación del Smartphone Nocturno de BarraOnline */}
        <div className="bo-glass-panel relative overflow-hidden rounded-[2.25rem] border border-white/[0.1] bg-[#0c0e17]/90 p-5 sm:p-6 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.85)]">
          {/* Brillo especular reactivo al puntero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-25 transition-opacity duration-300"
            style={{
              background: `radial-gradient(400px circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.14), transparent 60%)`,
            }}
          />

          {/* Barra de Estado del Teléfono */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/[0.06] pb-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">02:48 AM</span>
              <span>•</span>
              <span className="font-medium text-slate-300">Barra Principal</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Online
              </span>
            </div>
          </div>

          {/* Selector de Fases del Pedido */}
          <div className="relative z-10 mt-3.5">
            <div
              role="tablist"
              aria-label="Pasos de demostración"
              className="grid grid-cols-3 gap-1 rounded-xl bg-black/40 p-1 border border-white/[0.06]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={step === 'SELECT'}
                onClick={() => selectStepManually('SELECT')}
                className={`rounded-lg py-1.5 px-2 text-[11px] font-bold tracking-wide transition-all ${
                  step === 'SELECT'
                    ? 'bg-[#FF007A] text-white shadow-[0_0_16px_rgba(255,0,122,0.4)]'
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
                className={`rounded-lg py-1.5 px-2 text-[11px] font-bold tracking-wide transition-all ${
                  step === 'PAY'
                    ? 'bg-[#00F0FF] text-slate-950 shadow-[0_0_16px_rgba(0,240,255,0.35)]'
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
                className={`rounded-lg py-1.5 px-2 text-[11px] font-bold tracking-wide transition-all ${
                  step === 'QR_READY'
                    ? 'bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(16,185,129,0.35)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Pase QR
              </button>
            </div>
          </div>

          {/* FASE 1: ELEGIR TRAGO */}
          {step === 'SELECT' && (
            <div className="relative z-10 mt-4 space-y-3.5 animate-in fade-in duration-200">
              {/* Chips de Bebidas */}
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
                          ? 'border-[#FF007A]/50 bg-[#FF007A]/10 text-white shadow-sm'
                          : 'border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/[0.15] hover:text-white'
                      }`}
                    >
                      <div className="text-[9px] font-bold tracking-wider text-[#FF007A] uppercase">
                        {drink.tag}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold">
                        {drink.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Tarjeta del Trago Activo */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#FF007A] uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" />
                      {activeDrink.tag}
                    </span>
                    <h3 className="font-display text-base font-bold text-white sm:text-lg">
                      {activeDrink.name}
                    </h3>
                    <p className="text-xs text-slate-400">{activeDrink.subtitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display text-lg font-bold text-white sm:text-xl">
                      {formatArsFromCents(activeDrink.priceCents)}
                    </span>
                    <span className="block text-[10px] text-slate-500">c/u</span>
                  </div>
                </div>

                {/* Contador de unidades */}
                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                      Total ({qty} {qty === 1 ? 'unidad' : 'unidades'})
                    </span>
                    <div className="font-display tabular-nums text-xl font-bold text-white">
                      {formatArsFromCents(totalCents)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Disminuir"
                      onClick={() => {
                        setUserInteracted(true);
                        setQty((q) => Math.max(1, q - 1));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04] text-white hover:bg-white/[0.08] active:scale-95 transition"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="tabular-nums w-6 text-center text-sm font-bold text-white">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() => {
                        setUserInteracted(true);
                        setQty((q) => Math.min(6, q + 1));
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF007A] text-white hover:bg-[#FF1A8C] active:scale-95 transition shadow-[0_0_12px_rgba(255,0,122,0.3)]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón Pagar */}
              <button
                type="button"
                onClick={() => selectStepManually('PAY')}
                className="bo-btn-laser flex w-full items-center justify-between rounded-xl bg-[#FF007A] px-4 py-3 text-xs font-bold tracking-wider text-white uppercase shadow-[0_0_20px_rgba(255,0,122,0.35)]"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Reservar y Pagar con Mercado Pago
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* FASE 2: PAGO SEGURO MERCADO PAGO */}
          {step === 'PAY' && (
            <div className="relative z-10 mt-4 space-y-3.5 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[#00F0FF]/30 bg-gradient-to-b from-[#0a1520] to-[#090b14] p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 mb-3">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="inline-block rounded-full bg-[#00F0FF]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#00F0FF] uppercase tracking-wider">
                  Stock reservado al instante
                </span>
                <h3 className="font-display mt-2 text-base font-bold text-white">
                  {qty}x {activeDrink.name}
                </h3>
                <p className="mt-1 text-xs text-slate-300">
                  El dinero se acredita de forma directa en la cuenta de Mercado Pago del boliche.
                </p>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2 text-xs">
                  <span className="text-slate-400">Total a abonar</span>
                  <span className="font-display tabular-nums text-base font-bold text-[#00F0FF]">
                    {formatArsFromCents(totalCents)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => selectStepManually('QR_READY')}
                className="bo-btn-laser flex w-full items-center justify-between rounded-xl bg-[#00F0FF] px-4 py-3 text-xs font-bold tracking-wider text-slate-950 uppercase shadow-[0_0_20px_rgba(0,240,255,0.35)]"
              >
                <span className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Generar QR de Retiro en Barra
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* FASE 3: PASE QR */}
          {step === 'QR_READY' && (
            <div className="relative z-10 mt-4 space-y-3.5 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-emerald-400/35 bg-gradient-to-b from-emerald-950/40 to-[#090b14] p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Pago Aprobado
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    #BO-8492
                  </span>
                </div>

                <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                  <div className="relative shrink-0 overflow-hidden rounded-xl bg-white p-2.5 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
                    <svg
                      viewBox="0 0 100 100"
                      className="h-20 w-20 text-slate-950"
                      fill="currentColor"
                      role="img"
                      aria-label="Código QR"
                    >
                      <path d="M8 8h28v28H8V8zm6 6v16h16V14H14zm50-6h28v28H64V8zm6 6v16h16V14H70zM8 64h28v28H8V64zm6 6v16h16V70H14zm4-52h8v8h-8v-8zm52 0h8v8h-8v-8zM18 74h8v8h-8v-8zm26-66h8v14h-8V8zm10 14h6v14h-6V22zM44 44h12v12H44V44zm-28 0h14v8H16v-8zm56 0h20v8H72v-8zM44 64h8v28h-8V64zm16 8h14v8H60v-8zm16 12h16v8H76v-8zm-16 0h8v8h-8v-8zm20-20h12v8H80v-8z" />
                    </svg>
                  </div>

                  <div className="text-center sm:text-left">
                    <div className="text-[11px] font-bold text-emerald-300 uppercase">
                      Mostralo en barra
                    </div>
                    <h3 className="font-display text-sm font-bold text-white">
                      {qty}x {activeDrink.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-300 leading-snug">
                      El barman escanea tu pantalla en segundos y te entrega tu trago.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => selectStepManually('SELECT')}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white transition"
                >
                  Probar otra bebida
                </button>
                <a
                  href="#boliches"
                  className="bo-btn-laser inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 uppercase"
                >
                  <span>Ver boliches</span>
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
