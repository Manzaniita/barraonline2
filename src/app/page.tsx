import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  GlassWater,
  PartyPopper,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from 'lucide-react';
import { ensureDemoDataSeeded } from '@/db/seed';
import { listAllTenantsForDirectory } from '@/modules/tenancy/tenant-service';
import { NightlifeAtmosphereCanvas } from '@/components/experience/NightlifeAtmosphereCanvas';
import { HeroInteractiveStage } from '@/components/experience/HeroInteractiveStage';
import { LiveOrderJourneySimulator } from '@/components/experience/LiveOrderJourneySimulator';
import { SpotlightClubCard } from '@/components/experience/SpotlightClubCard';
import { LandingHeader } from '@/components/LandingHeader';
import { ScrollReveal } from '@/components/experience/ScrollReveal';

export const dynamic = 'force-dynamic';

const MARQUEE_ITEMS = [
  'PEDÍ DESDE LA PISTA',
  'PAGÁ CON MERCADO PAGO',
  'RETIRÁ CON QR SIN FILAS',
  'STOCK RESERVADO AL INSTANTE',
  'CERO EFECTIVO EN BARRA',
  'MÁS MÚSICA MENOS ESPERA',
];

export default async function HomePage() {
  await ensureDemoDataSeeded();
  const tenants = await listAllTenantsForDirectory();

  return (
    <div className="relative min-h-screen bg-[#040407] text-slate-100 selection:bg-[#FF2E63] selection:text-white">
      {/* Motor de Atmósfera Nocturna en Vivo (Canvas 60fps + Luces de Escenario + Partículas) */}
      <NightlifeAtmosphereCanvas />

      {/* Header Sticky con Autenticación Multi-Rol, Mis Pedidos y Acceso Administrativo */}
      <LandingHeader />

      <main className="relative z-10">
        {/* ====================================================================
            1. HERO INMERSIVO: ESCENARIO DE ALTO IMPACTO
            ==================================================================== */}
        <section className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6 lg:pt-14 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Columna Izquierda: Narrativa de Marca y CTAs Dominantes */}
            <div className="space-y-7 lg:col-span-7">
              <div className="animate-bo-reveal-1 inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#FF2E63]/40 bg-[#FF2E63]/12 px-4 py-1.5 text-xs font-black tracking-widest text-[#FF2E63] uppercase shadow-[0_0_30px_rgba(255,46,99,0.2)]">
                <Sparkles className="h-3.5 w-3.5 text-[#00F0FF]" />
                <span>Pedí sin filas • La noche desde tu celular</span>
              </div>

              <h1 className="animate-bo-reveal-2 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-[4.15rem] lg:leading-[1.03]">
                La noche es para bailarla.{' '}
                <span className="block bg-gradient-to-r from-[#FF2E63] via-[#FF7597] to-[#00F0FF] bg-clip-text text-transparent">
                  Pedí desde la pista y retirá con QR sin filas.
                </span>
              </h1>

              <p className="animate-bo-reveal-3 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-xl">
                Elegí tus tragos y combos desde el celular, pagá de forma segura
                con <strong className="font-bold text-white">Mercado Pago</strong> y
                retirá en segundos mostrando tu código QR en la barra. Menos espera
                en cajas, más fiesta con tus amigos.
              </p>

              {/* CTAs Principales */}
              <div className="animate-bo-reveal-4 flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#boliches"
                  className="bo-btn-laser inline-flex items-center gap-3 rounded-2xl bg-[#FF2E63] px-7 py-4 text-sm font-black tracking-wider text-white uppercase shadow-[0_0_35px_rgba(255,46,99,0.55)]"
                >
                  <span>Ver boliches adheridos</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <a
                  href="#como-funciona"
                  className="bo-gpu-transition inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-4 text-sm font-extrabold tracking-wider text-slate-100 uppercase backdrop-blur-md hover:border-[#00F0FF]/50 hover:bg-white/10"
                >
                  <QrCode className="h-4 w-4 text-[#00F0FF]" />
                  <span>Cómo funciona</span>
                </a>
              </div>

              {/* Micro-Tarjetas de Valor Instantáneo */}
              <div className="animate-bo-reveal-4 grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-[#FF2E63]/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#FF2E63] uppercase">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Cero filas</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Pedís directo desde la pista sin pasar por caja.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-emerald-400/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400 uppercase">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Mercado Pago</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Aboná con dinero en cuenta o tarjetas al toque.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-[#00F0FF]/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#00F0FF] uppercase">
                    <QrCode className="h-3.5 w-3.5 shrink-0" />
                    <span>Retiro QR</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Mostrás tu código en barra y retirás al momento.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-amber-400/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-400 uppercase">
                    <PartyPopper className="h-3.5 w-3.5 shrink-0" />
                    <span>Stock tuyo</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Tu bebida queda reservada mientras completás el pago.
                  </p>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Escenario Interactivo 3D en Vivo */}
            <div className="lg:col-span-5">
              <HeroInteractiveStage />
            </div>
          </div>
        </section>

        {/* ====================================================================
            2. CINTA CINÉTICA DE ENERGÍA NOCTURNA (MARQUEE)
            ==================================================================== */}
        <div
          aria-hidden="true"
          className="relative overflow-hidden border-y border-white/10 bg-[#080A11]/90 py-4 backdrop-blur-md"
        >
          <div className="animate-bo-marquee flex items-center gap-10 whitespace-nowrap">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
              <div key={`${item}-${idx}`} className="flex items-center gap-10">
                <span
                  className={
                    idx % 2 === 0
                      ? 'text-sm font-black tracking-[0.2em] text-white uppercase sm:text-base'
                      : 'bo-text-outline text-sm font-black tracking-[0.2em] uppercase sm:text-base'
                  }
                >
                  {item}
                </span>
                <span className="h-2 w-2 rotate-45 bg-[#FF2E63] shadow-[0_0_12px_#FF2E63]" />
              </div>
            ))}
          </div>
        </div>

        {/* ====================================================================
            3. PORTALES DE BOLICHES ADHERIDOS (ACCESO DIRECTO A LA CARTA)
            ==================================================================== */}
        <section
          id="boliches"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-8 lg:flex-row lg:items-end">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  <Flame className="h-4 w-4 text-[#FF2E63]" />
                  <span>Temporada Costa Argentina • Cartas en vivo</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Boliches Adheridos
                </h2>
                <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                  Entrá directo a la carta digital de tu boliche, armá tu pedido
                  desde el celular y recibí tu código QR para retirar sin hacer fila.
                </p>
              </div>

              <div className="bo-glass-pill inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 text-xs font-bold text-emerald-300 lg:self-auto">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_#10B981]" />
                <span>Carta digital activa esta noche</span>
              </div>
            </div>
          </ScrollReveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {tenants.map((tenant, idx) => (
              <ScrollReveal key={tenant.id} delayMs={idx * 120}>
                <SpotlightClubCard
                  id={tenant.id}
                  slug={tenant.slug}
                  fantasyName={tenant.fantasy_name}
                  city={tenant.city}
                  address={tenant.address}
                  accentPrimary={tenant.theme_config?.accentPrimary || '#FF2E63'}
                  accentSecondary={
                    tenant.theme_config?.accentSecondary || '#00F0FF'
                  }
                  accentOnPrimary={
                    tenant.theme_config?.accentOnPrimary || '#FFFFFF'
                  }
                  heroBadge={
                    tenant.theme_config?.heroBadge || 'BOLICHE ADHERIDO'
                  }
                  tagline={
                    tenant.theme_config?.tagline ||
                    'Pedí tus bebidas desde la pista, pagá seguro y retirá con QR sin hacer filas.'
                  }
                  isFeatured={tenant.is_featured}
                  commercialTag={tenant.commercial_tag}
                  index={idx}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ====================================================================
            4. DEMOSTRACIÓN VISUAL INTERACTIVA: ¿CÓMO FUNCIONA BARRAONLINE?
            ==================================================================== */}
        <section
          id="como-funciona"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-16 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-10 max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FF2E63]/35 bg-[#FF2E63]/10 px-3.5 py-1 text-xs font-black tracking-widest text-[#FF2E63] uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                Recorrido interactivo del pedido
              </span>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                ¿Cómo funciona BarraOnline?
              </h2>
              <p className="text-base text-slate-300 sm:text-lg">
                Explorá paso a paso cómo pasás de elegir tu trago en medio de la
                pista a tenerlo en la mano en segundos, sin hacer fila en la caja.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={100}>
            <LiveOrderJourneySimulator />
          </ScrollReveal>
        </section>

        {/* ====================================================================
            5. COMPOSICIÓN ASIMÉTRICA: LA NOCHE REINVENTADA (CONTRASTE VISUAL)
            ==================================================================== */}
        <section
          id="ventajas"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl space-y-3">
                <span className="text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  Diseñado para el ritmo de la noche
                </span>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Olvidate de las cajas y los tickets de papel.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">
                Reemplazamos la doble fila tradicional por un flujo directo desde
                tu teléfono hasta el mostrador de entrega.
              </p>
            </div>
          </ScrollReveal>

          {/* Bento Asimétrico de Gran Escala (No 3 tarjetas iguales) */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Bloque Principal (7 columnas): Comparativa Visual de la Noche */}
            <ScrollReveal className="lg:col-span-7" direction="left">
              <div className="bo-glass-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2.25rem] p-6 sm:p-9">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#FF2E63]/20 blur-3xl"
                />

                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-black tracking-wider text-white uppercase">
                    <Zap className="h-3.5 w-3.5 text-[#FF2E63]" />
                    Cambio de paradigma en pista
                  </div>

                  <h3 className="text-2xl font-black text-white sm:text-3xl">
                    Antes hacías dos filas para tomar algo. Ahora no hacés ninguna.
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* El Ritual Viejo */}
                    <div className="rounded-2xl border border-rose-500/20 bg-black/50 p-4 space-y-2.5 opacity-80">
                      <div className="text-[11px] font-black tracking-wider text-rose-400 uppercase">
                        ✕ El método viejo
                      </div>
                      <ul className="space-y-2 text-xs text-slate-400">
                        <li>• Salir de la pista y perder a tu grupo de amigos.</li>
                        <li>• Hacer 20 minutos de fila en caja para pagar.</li>
                        <li>• Cuidar un ticket de papel húmedo que se pierde.</li>
                        <li>• Volver a empujar en la barra para que te atiendan.</li>
                      </ul>
                    </div>

                    {/* El Ritual BarraOnline */}
                    <div className="rounded-2xl border border-emerald-400/40 bg-emerald-950/25 p-4 space-y-2.5 shadow-[0_0_30px_rgba(16,185,129,0.12)]">
                      <div className="text-[11px] font-black tracking-wider text-emerald-300 uppercase">
                        ✓ Con BarraOnline
                      </div>
                      <ul className="space-y-2 text-xs text-slate-200">
                        <li>• Elegís tus bebidas sin moverte de la pista.</li>
                        <li>• Pagás en segundos desde tu celular con Mercado Pago.</li>
                        <li>• Tu QR único queda guardado en tu pantalla.</li>
                        <li>• Te acercás a la barra solo para retirar y seguir bailando.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                  <div className="text-xs text-slate-300">
                    Sin descargas ni registros obligatorios:{' '}
                    <strong className="text-white">
                      comprás como invitado rápido en segundos.
                    </strong>
                  </div>
                  <a
                    href="#boliches"
                    className="inline-flex items-center gap-1.5 text-xs font-black tracking-wider text-[#00F0FF] uppercase hover:underline"
                  >
                    Ir a las cartas activas
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </ScrollReveal>

            {/* Columna Derecha Apilada (5 columnas): 2 Composiciones Gráficas */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <ScrollReveal delayMs={120} direction="right">
                <div className="bo-glass-panel relative overflow-hidden rounded-[2.25rem] p-6 sm:p-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#00F0FF]/20 blur-2xl"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black tracking-widest text-[#00F0FF] uppercase">
                        RESERVA GARANTIZADA
                      </span>
                      <GlassWater className="h-5 w-5 text-[#00F0FF]" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                      Tus bebidas te esperan frías, nunca al revés
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Cuando iniciás tu compra, el stock de tu bebida o combo VIP
                      queda reservado para vos. Nadie se lleva la última botella
                      mientras confirmás el pago.
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={220} direction="right">
                <div className="bo-glass-panel relative overflow-hidden rounded-[2.25rem] p-6 sm:p-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-purple-500/20 blur-2xl"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black tracking-widest text-purple-300 uppercase">
                        MODO OFFLINE LISTO
                      </span>
                      <QrCode className="h-5 w-5 text-purple-300" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                      ¿Poca señal adentro del club? Tu QR funciona igual
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Apenas se aprueba tu pago, podés guardar tu pase QR como
                      imagen en tu galería con un toque para mostrarlo en la barra
                      incluso sin conexión.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ====================================================================
            6. SECCIÓN PARA ESTABLECIMIENTOS Y BOLICHES (B2B)
            ==================================================================== */}
        <section
          id="para-boliches"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-16 sm:px-6"
        >
          <ScrollReveal direction="scale">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-[#101526] via-[#0B0D18] to-[#1A1026] p-8 sm:p-12 lg:p-14 shadow-[0_30px_90px_rgba(0,0,0,0.85)]">
              {/* Luces ambientales de escenario B2B */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-32 right-10 h-96 w-96 rounded-full bg-[#00F0FF]/15 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[#FF2E63]/15 blur-3xl"
              />

              <div className="relative z-10 grid gap-10 lg:grid-cols-12 lg:items-center">
                <div className="space-y-5 lg:col-span-6">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-1 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                    <Store className="h-3.5 w-3.5" />
                    Para dueños y encargados
                  </span>

                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
                    Agilizá tu barra y aumentá las ventas de tu local
                  </h2>

                  <p className="text-base leading-relaxed text-slate-300">
                    BarraOnline optimiza los tiempos de atención, elimina los
                    cuellos de botella en las cajas y transforma cada barra en un
                    punto de entrega rápida con validación QR en segundos.
                  </p>

                  <div className="pt-2">
                    <a
                      href="mailto:contacto@barraonline.com.ar?subject=Sumar%20mi%20boliche%20a%20BarraOnline"
                      className="bo-btn-laser inline-flex items-center gap-3 rounded-2xl bg-white px-7 py-4 text-xs font-black tracking-wider text-[#070709] uppercase shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:bg-slate-100"
                    >
                      <span>Sumar mi boliche a BarraOnline</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Pilares Operativos para el Establecimiento */}
                <div className="grid gap-4 sm:grid-cols-3 lg:col-span-6 lg:grid-cols-1">
                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-md">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF2E63]/20 text-[#FF2E63]">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        Mayor rotación en barra
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        Los bármanes solo preparan y entregan bebidas escaneando el
                        código QR en segundos, sin manipular billetes ni terminales
                        físicas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-md">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        Acreditación directa
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        El dinero de cada venta ingresa de forma directa e inmediata
                        a la cuenta de Mercado Pago de tu establecimiento.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-md">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#00F0FF]/20 text-[#00F0FF]">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        Control de stock en vivo
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        Gestioná tu carta, precios, promociones y disponibilidad en
                        tiempo real con bloqueo automático cuando un producto se
                        agota.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ====================================================================
            7. CIERRE CINEMATOGRÁFICO DE CONVERSIÓN
            ==================================================================== */}
        <section className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0A0C14]/90 px-6 py-14 text-center sm:px-12 sm:py-20">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,46,99,0.22),rgba(0,240,255,0.08)_45%,transparent_75%)]"
              />
              <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF2E63]" />
                  Viví la noche sin pausas
                </span>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  ¿Listo para pedir desde la pista?
                </h2>
                <p className="text-sm text-slate-300 sm:text-base">
                  Elegí tu boliche adherido, armá tu pedido en segundos y retirá
                  directo en barra con tu código QR.
                </p>
                <div className="pt-2">
                  <a
                    href="#boliches"
                    className="bo-btn-laser inline-flex items-center gap-3 rounded-2xl bg-[#FF2E63] px-8 py-4 text-sm font-black tracking-wider text-white uppercase shadow-[0_0_35px_rgba(255,46,99,0.55)]"
                  >
                    <span>Elegir boliche y pedir ahora</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      {/* ====================================================================
          8. FOOTER COHERENTE CON LA IDENTIDAD DE MARCA
          ==================================================================== */}
      <footer className="relative z-10 border-t border-white/10 bg-[#030306] py-12 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <img
                src="/logo-barraonline.png"
                alt="BarraOnline — Pedí • Pagá • Retirá"
                className="h-9 w-auto object-contain drop-shadow-[0_0_14px_rgba(255,0,204,0.3)] sm:h-10"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 max-w-xl text-slate-300">
              <strong className="text-white">+18 Ley 24.788:</strong> Prohibida la
              venta y entrega de bebidas alcohólicas a menores de 18 años. Beber
              con moderación.
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-[11px] text-slate-500 sm:flex-row">
            <p>
              © {new Date().getFullYear()} BarraOnline. Todos los derechos
              reservados.
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#boliches" className="hover:text-slate-300 transition">
                Boliches Adheridos
              </a>
              <span>•</span>
              <a
                href="#como-funciona"
                className="hover:text-slate-300 transition"
              >
                Cómo Funciona
              </a>
              <span>•</span>
              <a
                href="#para-boliches"
                className="hover:text-slate-300 transition"
              >
                Contacto Comercial
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
