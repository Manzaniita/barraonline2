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
    subtitle: 'Precios claros, promos de la noche y stock real en vivo.',
    description:
      'Escaneás el acceso del club o entrás desde BarraOnline. Ves todos los tragos, botellas VIP, cervezas y agua con disponibilidad actualizada al instante.',
    accent: '#FF2E63',
    timeMetric: '10 SEG',
    userExperience:
      'Seguís con tus amigos escuchando el set mientras armás el pedido con un pulgar.',
    barExperience:
      'El catálogo muestra únicamente las bebidas que tienen stock disponible en ese momento.',
  },
  {
    id: 1,
    code: '02',
    badge: 'PAGO SEGURO',
    title: 'Pagás con Mercado Pago y tu bebida queda reservada',
    subtitle: 'Sin efectivo, sin tarjetas físicas ni tickets de papel que se pierden.',
    description:
      'Al iniciar el pago, BarraOnline aparta tus bebidas para que nadie te gane la última unidad. Abonás con dinero en cuenta o tarjeta en segundos.',
    accent: '#00F0FF',
    timeMetric: 'INSTANTÁNEO',
    userExperience:
      'Cero filas en la caja. Pagás desde tu celular con la seguridad de tu cuenta.',
    barExperience:
      'El pago ingresa de forma directa y automática a la cuenta del establecimiento.',
  },
  {
    id: 2,
    code: '03',
    badge: 'PASE EN PANTALLA',
    title: 'Recibís tu código QR único de alto contraste',
    subtitle: 'Listo para usar al instante y descargable en tu teléfono.',
    description:
      'Apenas se confirma el pago, tu pantalla se ilumina con tu pase QR único y tu código corto de retiro. Podés guardarlo como imagen para mostrarlo incluso sin señal.',
    accent: '#A855F7',
    timeMetric: 'QR ÚNICO',
    userExperience:
      'Tu pase queda guardado en tu pantalla listo para cuando quieras acercarte a retirar.',
    barExperience:
      'Cada código es único e irrepetible, garantizando una entrega rápida y sin confusiones.',
  },
  {
    id: 3,
    code: '04',
    badge: 'RETIRO EXPRÉS',
    title: 'Mostrás tu QR en barra y retirás al toque',
    subtitle: 'El barman escanea en 2 segundos y te entrega tu pedido bien frío.',
    description:
      'Te acercás directo a la barra, mostrás tu QR y el personal valida tu pedido con un solo escaneo. Sin esperar cambio ni demoras.',
    accent: '#10B981',
    timeMetric: '< 2 SEG',
    userExperience:
      'Retirás tus vasos o tu combo y volvés a la pista en tiempo récord.',
    barExperience:
      'Los bármanes se dedican 100% a preparar y entregar bebidas sin tocar billetes.',
  },
];

export function LiveOrderJourneySimulator() {
  const [activePhase, setActivePhase] = useState<number>(0);
  const [perspectiveMode, setPerspectiveMode] = useState<'PARTYGOER' | 'BAR'>(
    'PARTYGOER'
  );

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
              className={`group relative w-full overflow-hidden rounded-3xl border p-5 text-left transition-all duration-300 ${
                isActive
                  ? 'border-white/25 bg-gradient-to-r from-[#161927] to-[#0E111B] shadow-[0_16px_40px_rgba(0,0,0,0.65)]'
                  : 'border-white/8 bg-[#0B0D14]/70 hover:border-white/15 hover:bg-[#111420]/80'
              }`}
            >
              {/* Barra lateral luminosa activa */}
              <div
                aria-hidden="true"
                style={{
                  backgroundColor: isActive ? phase.accent : 'transparent',
                  boxShadow: isActive ? `0 0 20px ${phase.accent}` : 'none',
                }}
                className="absolute inset-y-0 left-0 w-1.5 transition-all duration-300"
              />

              <div className="flex items-start justify-between gap-4 pl-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{ color: isActive ? phase.accent : '#64748B' }}
                      className="font-mono text-xs font-black tracking-widest"
                    >
                      PASO {phase.code}
                    </span>
                    <span
                      style={{
                        borderColor: isActive
                          ? `${phase.accent}55`
                          : 'rgba(255,255,255,0.08)',
                        backgroundColor: isActive
                          ? `${phase.accent}18`
                          : 'rgba(255,255,255,0.03)',
                        color: isActive ? phase.accent : '#94A3B8',
                      }}
                      className="rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wider uppercase"
                    >
                      {phase.badge}
                    </span>
                  </div>

                  <h3
                    className={`text-base font-black transition-colors sm:text-lg ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-300 group-hover:text-white'
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
                  style={{
                    color: isActive ? phase.accent : '#475569',
                  }}
                  className="shrink-0 font-mono text-xs font-black uppercase"
                >
                  {phase.timeMetric}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Columna Derecha: Escenario Cinematográfico del Paso Activo */}
      <div className="lg:col-span-7">
        <div className="bo-glass-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2.25rem] p-6 sm:p-8">
          {/* Resplandor ambiental según el paso activo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full opacity-35 blur-3xl transition-all duration-700"
            style={{ backgroundColor: current.accent }}
          />

          {/* Cabecera del visor con conmutador de punto de vista */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: `${current.accent}22`,
                  color: current.accent,
                  borderColor: `${current.accent}55`,
                }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border font-mono text-lg font-black shadow-lg"
              >
                {current.code}
              </div>
              <div>
                <div
                  style={{ color: current.accent }}
                  className="text-xs font-black tracking-widest uppercase"
                >
                  {current.badge} • {current.timeMetric}
                </div>
                <div className="text-sm font-bold text-slate-300">
                  Secuencia interactiva de pedido nocturno
                </div>
              </div>
            </div>

            {/* Selector de perspectiva: Tu experiencia vs En la barra */}
            <div className="flex rounded-xl border border-white/10 bg-black/50 p-1">
              <button
                type="button"
                onClick={() => setPerspectiveMode('PARTYGOER')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase transition ${
                  perspectiveMode === 'PARTYGOER'
                    ? 'bg-white text-[#070709]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                En tu celular
              </button>
              <button
                type="button"
                onClick={() => setPerspectiveMode('BAR')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase transition ${
                  perspectiveMode === 'BAR'
                    ? 'bg-[#00F0FF] text-[#070709]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GlassWater className="h-3.5 w-3.5" />
                En la barra
              </button>
            </div>
          </div>

          {/* Escena Visual Central Dinámica */}
          <div className="relative z-10 my-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {current.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
                {current.description}
              </p>
            </div>

            {/* Representación Gráfica Interactiva del Estado */}
            <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[#07080D]/90 p-5">
              {activePhase === 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#FF2E63]/40 bg-[#FF2E63]/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#FF2E63] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                        PROMO NOCHE
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        • Disponible
                      </span>
                    </div>
                    <div className="text-base font-black text-white">
                      Fernet Branca + Coca XL
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="tabular-nums text-lg font-black text-white">
                        $ 12.000,00
                      </span>
                      <span className="rounded-lg bg-[#FF2E63] px-2.5 py-1 text-[11px] font-black text-white">
                        + Agregar
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#00F0FF]/20 px-2 py-0.5 text-[10px] font-black text-[#00F0FF] uppercase">
                        COMBO VIP
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        • Disponible
                      </span>
                    </div>
                    <div className="text-base font-black text-white">
                      Botella Absolut + 4 Speed
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="tabular-nums text-lg font-black text-white">
                        $ 85.000,00
                      </span>
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white">
                        + Agregar
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activePhase === 1 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#00F0FF]/20 text-[#00F0FF] shadow-[0_0_25px_rgba(0,240,255,0.3)]">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wider text-[#00F0FF] uppercase">
                        RESERVA ACTIVA DE STOCK
                      </div>
                      <div className="text-base font-black text-white">
                        Tus bebidas quedan apartadas al instante
                      </div>
                      <div className="text-xs text-slate-400">
                        Abonás desde tu celular con Mercado Pago sin hacer fila en caja
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl bg-[#009EE3] px-4 py-2.5 text-xs font-black text-white uppercase shadow-lg">
                    Pago Confirmado ✓
                  </div>
                </div>
              )}

              {activePhase === 2 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-4">
                    <div className="relative rounded-2xl bg-white p-2.5 text-[#070709] shadow-[0_0_25px_rgba(168,85,247,0.45)]">
                      <QrCode className="h-12 w-12" />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wider text-purple-400 uppercase">
                        PASE QR DE ALTO CONTRASTE
                      </div>
                      <div className="font-mono text-xl font-black text-white">
                        CÓDIGO: BO-9410
                      </div>
                      <div className="text-xs text-slate-400">
                        Descargable como imagen PNG para usarlo incluso sin señal
                      </div>
                    </div>
                  </div>
                  <span className="rounded-xl border border-purple-400/40 bg-purple-500/15 px-3.5 py-2 text-xs font-black text-purple-300 uppercase">
                    Listo para retirar
                  </span>
                </div>
              )}

              {activePhase === 3 && (
                <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-[#070709] shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-wider text-emerald-400 uppercase">
                        VALIDACIÓN EN MOSTRADOR &lt; 2 SEGUNDOS
                      </div>
                      <div className="text-base font-black text-white">
                        Pedido entregado en mano • Cero espera
                      </div>
                      <div className="text-xs text-slate-300">
                        Mostrás tu QR, recibís tus tragos y volvés directo a la pista
                      </div>
                    </div>
                  </div>
                  <a
                    href="#boliches"
                    className="shrink-0 rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-black text-[#070709] uppercase shadow-lg"
                  >
                    Elegir boliche
                  </a>
                </div>
              )}
            </div>

            {/* Tarjeta de Punto de Vista Activo */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-white">
                <Sparkles
                  className="h-4 w-4"
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
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              {PHASES.map((p, idx) => (
                <button
                  key={p.code}
                  type="button"
                  aria-label={`Ir al paso ${p.code}`}
                  onClick={() => setActivePhase(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === activePhase
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActivePhase((prev) => (prev + 1) % PHASES.length)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black tracking-wider text-white uppercase hover:bg-white/12 transition"
            >
              {activePhase === PHASES.length - 1 ? (
                <>
                  Reiniciar recorrido
                  <Zap className="h-3.5 w-3.5 text-[#FF2E63]" />
                </>
              ) : (
                <>
                  Siguiente paso
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
