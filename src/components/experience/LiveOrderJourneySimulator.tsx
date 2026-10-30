'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  GlassWater,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Zap,
} from 'lucide-react';

interface JourneyPhase {
  id: number;
  code: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  timeMetric: string;
  userExperience: string;
  barExperience: string;
}

const PHASES: JourneyPhase[] = [
  {
    id: 0,
    code: '01',
    badge: 'DESDE LA PISTA',
    title: 'Abrís la carta del boliche sin moverte del lugar',
    subtitle: 'Precios claros, combos de la noche y stock en tiempo real.',
    description:
      'Escaneás el QR del club o ingresás desde BarraOnline. Ves todos los tragos, botellas VIP y cervezas con disponibilidad actualizada al instante.',
    accent: '#FF007A',
    timeMetric: '10 SEG',
    userExperience:
      'Seguís con tus amigos escuchando la música mientras armás el pedido desde tu celular.',
    barExperience:
      'El catálogo muestra únicamente las bebidas que tienen stock disponible en ese momento.',
  },
  {
    id: 1,
    code: '02',
    badge: 'PAGO SEGURO',
    title: 'Pagás con Mercado Pago y tu bebida queda reservada',
    subtitle: 'Sin efectivo, sin tarjetas físicas ni tickets que se rompen.',
    description:
      'Al abonar, BarraOnline aparta tus bebidas para que nadie te gane la última unidad. Pagás con dinero en cuenta o tarjeta en segundos.',
    accent: '#00F0FF',
    timeMetric: 'INSTANTÁNEO',
    userExperience:
      'Cero filas en la caja. Pagás desde tu celular con la seguridad y respaldo de tu cuenta.',
    barExperience:
      'El dinero ingresa de forma directa y automática a la cuenta de Mercado Pago del local.',
  },
  {
    id: 2,
    code: '03',
    badge: 'PASE EN PANTALLA',
    title: 'Recibís tu código QR único de alto contraste',
    subtitle: 'Listo para usar al instante y guardable en tu teléfono.',
    description:
      'Apenas se confirma el pago, tu pantalla muestra tu pase QR único y tu código de retiro. Podés guardarlo para mostrarlo incluso sin señal.',
    accent: '#A855F7',
    timeMetric: 'QR ÚNICO',
    userExperience:
      'Tu pase queda guardado en tu pantalla listo para cuando decidas acercarte a la barra.',
    barExperience:
      'Cada código es único e infalsificable, garantizando una entrega rápida y sin confusiones.',
  },
  {
    id: 3,
    code: '04',
    badge: 'RETIRO EXPRÉS',
    title: 'Mostrás tu QR en barra y retirás al instante',
    subtitle: 'El barman escanea en 2 segundos y te entrega tu trago bien frío.',
    description:
      'Te acercás al mostrador de retiro, mostrás tu QR y el personal valida tu pedido con un solo escaneo. Sin esperar cambio ni demoras.',
    accent: '#10B981',
    timeMetric: '< 2 SEG',
    userExperience:
      'Retirás tus vasos o tu combo y volvés a la pista en tiempo récord.',
    barExperience:
      'Los bármanes se dedican 100% a preparar y entregar bebidas sin manipular billetes.',
  },
];

export function LiveOrderJourneySimulator() {
  const [activePhase, setActivePhase] = useState<number>(0);
  const [perspectiveMode, setPerspectiveMode] = useState<'PARTYGOER' | 'BAR'>('PARTYGOER');

  const current = PHASES[activePhase] ?? PHASES[0]!;

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
      {/* Columna Izquierda: Selector Narrativo de 4 Fases */}
      <div className="flex flex-col justify-between space-y-3 lg:col-span-5">
        {PHASES.map((phase, idx) => {
          const isActive = idx === activePhase;
          return (
            <button
              key={phase.code}
              type="button"
              onClick={() => setActivePhase(idx)}
              className={`group relative w-full overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all duration-200 ${
                isActive
                  ? 'border-white/[0.2] bg-[#121422] shadow-[0_16px_36px_rgba(0,0,0,0.7)]'
                  : 'border-white/[0.07] bg-[#090a12]/70 hover:border-white/[0.14] hover:bg-[#0f111c]/80'
              }`}
            >
              {/* Indicador lateral sutil */}
              <div
                aria-hidden="true"
                style={{
                  backgroundColor: isActive ? phase.accent : 'transparent',
                }}
                className="absolute inset-y-0 left-0 w-1 transition-all duration-200"
              />

              <div className="flex items-start justify-between gap-4 pl-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ color: isActive ? phase.accent : '#64748B' }}
                      className="font-mono text-[11px] font-bold tracking-wider"
                    >
                      PASO {phase.code}
                    </span>
                    <span
                      style={{
                        borderColor: isActive ? `${phase.accent}40` : 'rgba(255,255,255,0.08)',
                        backgroundColor: isActive ? `${phase.accent}12` : 'rgba(255,255,255,0.03)',
                        color: isActive ? phase.accent : '#94A3B8',
                      }}
                      className="rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase"
                    >
                      {phase.badge}
                    </span>
                  </div>

                  <h3
                    className={`font-display text-sm sm:text-base font-bold transition-colors ${
                      isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                    }`}
                  >
                    {phase.title}
                  </h3>

                  {isActive && (
                    <p className="pt-1 text-xs leading-relaxed text-slate-300">
                      {phase.subtitle}
                    </p>
                  )}
                </div>

                <span
                  style={{ color: isActive ? phase.accent : '#475569' }}
                  className="shrink-0 font-mono text-[11px] font-bold uppercase"
                >
                  {phase.timeMetric}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Columna Derecha: Escenario Detallado del Paso Activo */}
      <div className="lg:col-span-7">
        <div className="bo-glass-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] p-6 sm:p-8">
          {/* Cabecera del visor con conmutador de punto de vista */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: `${current.accent}15`,
                  color: current.accent,
                  borderColor: `${current.accent}35`,
                }}
                className="font-display flex h-11 w-11 items-center justify-center rounded-xl border text-base font-bold"
              >
                {current.code}
              </div>
              <div>
                <div
                  style={{ color: current.accent }}
                  className="text-xs font-bold tracking-widest uppercase"
                >
                  {current.badge} • {current.timeMetric}
                </div>
                <div className="text-xs text-slate-400">
                  Secuencia del pedido en BarraOnline
                </div>
              </div>
            </div>

            {/* Selector de perspectiva */}
            <div className="flex rounded-xl border border-white/[0.1] bg-black/40 p-1">
              <button
                type="button"
                onClick={() => setPerspectiveMode('PARTYGOER')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  perspectiveMode === 'PARTYGOER'
                    ? 'bg-white text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>En tu celular</span>
              </button>
              <button
                type="button"
                onClick={() => setPerspectiveMode('BAR')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  perspectiveMode === 'BAR'
                    ? 'bg-[#00F0FF] text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GlassWater className="h-3.5 w-3.5" />
                <span>En la barra</span>
              </button>
            </div>
          </div>

          {/* Escena Visual Central Dinámica */}
          <div className="relative z-10 my-6 space-y-6">
            <div className="space-y-2">
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                {current.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                {current.description}
              </p>
            </div>

            {/* Representación Gráfica Interactiva */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080911]/90 p-5">
              {activePhase === 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#FF007A]/30 bg-[#FF007A]/10 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#FF007A] px-2 py-0.5 text-[9px] font-bold text-white uppercase">
                        PROMO PISTA
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400">
                        • En stock
                      </span>
                    </div>
                    <div className="font-display text-sm font-bold text-white">
                      Fernet Branca + Cola XL
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-display tabular-nums text-base font-bold text-white">
                        $ 12.000,00
                      </span>
                      <span className="rounded-lg bg-[#FF007A] px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                        + Agregar
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-bold text-slate-300 uppercase">
                        COMBO VIP
                      </span>
                      <span className="text-[11px] font-medium text-emerald-400">
                        • En stock
                      </span>
                    </div>
                    <div className="font-display text-sm font-bold text-white">
                      Botella Absolut + 4 Speed
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="font-display tabular-nums text-base font-bold text-white">
                        $ 85.000,00
                      </span>
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white uppercase">
                        + Agregar
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activePhase === 1 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-[#00F0FF] uppercase tracking-wider">
                        RESERVA INMEDIATA DE STOCK
                      </div>
                      <div className="font-display text-sm font-bold text-white">
                        Tus tragos quedan apartados al instante
                      </div>
                      <div className="text-xs text-slate-400">
                        Abonás desde tu celular con Mercado Pago sin hacer fila en caja
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-xl bg-[#009EE3] px-3.5 py-2 text-xs font-bold text-white uppercase">
                    Pago Aprobado ✓
                  </div>
                </div>
              )}

              {activePhase === 2 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3.5">
                    <div className="relative rounded-xl bg-white p-2 text-slate-950 shadow-md">
                      <QrCode className="h-10 w-10" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                        PASE QR DE ALTO CONTRASTE
                      </div>
                      <div className="font-mono text-base font-bold text-white">
                        CÓDIGO: BO-9410
                      </div>
                      <div className="text-xs text-slate-400">
                        Descargable como imagen para usarlo incluso sin señal de celular
                      </div>
                    </div>
                  </div>
                  <span className="rounded-xl border border-purple-400/30 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold text-purple-300">
                    Listo para retiro
                  </span>
                </div>
              )}

              {activePhase === 3 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                        VALIDACIÓN EN MOSTRADOR EN 2 SEGUNDOS
                      </div>
                      <div className="font-display text-sm font-bold text-white">
                        Pedido entregado en mano • Cero espera
                      </div>
                      <div className="text-xs text-slate-300">
                        Mostrás tu QR, el barman escanea y volvés directo a la pista
                      </div>
                    </div>
                  </div>
                  <a
                    href="#boliches"
                    className="shrink-0 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-slate-950 uppercase"
                  >
                    Ver boliches
                  </a>
                </div>
              )}
            </div>

            {/* Tarjeta de Perspectiva */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-white">
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: current.accent }}
                />
                {perspectiveMode === 'PARTYGOER'
                  ? 'Lo que vivís vos en la noche:'
                  : 'Lo que ocurre en la barra del boliche:'}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
                {perspectiveMode === 'PARTYGOER'
                  ? current.userExperience
                  : current.barExperience}
              </p>
            </div>
          </div>

          {/* Pie del Simulador con Progreso y Siguiente Paso */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] pt-4">
            <div className="flex items-center gap-2">
              {PHASES.map((p, idx) => (
                <button
                  key={p.code}
                  type="button"
                  aria-label={`Ir al paso ${p.code}`}
                  onClick={() => setActivePhase(idx)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === activePhase ? 'w-6 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActivePhase((prev) => (prev + 1) % PHASES.length)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.08] transition"
            >
              {activePhase === PHASES.length - 1 ? (
                <>
                  <span>Reiniciar</span>
                  <Zap className="h-3.5 w-3.5 text-[#FF007A]" />
                </>
              ) : (
                <>
                  <span>Siguiente paso</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
