import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Flame,
  GlassWater,
  Layers,
  MessageCircle,
  PartyPopper,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Zap,
} from 'lucide-react';
import { ensureDemoDataSeeded } from '@/db/seed';
import { listAllTenantsForDirectory } from '@/modules/tenancy/tenant-service';
import { NightlifeAtmosphereCanvas } from '@/components/experience/NightlifeAtmosphereCanvas';
import { HeroInteractiveStage } from '@/components/experience/HeroInteractiveStage';
import { LiveOrderJourneySimulator } from '@/components/experience/LiveOrderJourneySimulator';
import { SpotlightClubCard } from '@/components/experience/SpotlightClubCard';
import { BrandIdentityShowcase } from '@/components/experience/BrandIdentityShowcase';
import { CommercialContactForm } from '@/components/CommercialContactForm';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { LandingHeader } from '@/components/LandingHeader';
import { ScrollReveal } from '@/components/experience/ScrollReveal';

export const dynamic = 'force-dynamic';

const MARQUEE_ITEMS = [
  'PEDIDOS DIGITALES EN BARRA',
  'PAGOS DIRECTOS CON MERCADO PAGO',
  'RETIRO CON QR EN SEGUNDOS',
  'CONTROL DE STOCK EN TIEMPO REAL',
  'CERO FILAS EN CAJAS',
  'IDENTIDAD PROPIA PARA TU BOLICHE',
  'MÁS TIEMPO EN PISTA MENOS ESPERA',
];

const WHATSAPP_DIRECT_URL =
  'https://wa.me/5492236237874?text=' +
  encodeURIComponent(
    'Hola, quiero conocer BarraOnline para mi boliche. Me gustaría recibir información y saber cómo puedo incorporarlo a mi establecimiento.'
  );

export default async function HomePage() {
  await ensureDemoDataSeeded();
  const tenants = await listAllTenantsForDirectory();

  return (
    <div className="relative min-h-screen bg-[#040407] text-slate-100 selection:bg-[#FF2E63] selection:text-white">
      {/* Motor de Atmósfera Nocturna en Vivo (Canvas 60fps con luces de escenario y partículas) */}
      <NightlifeAtmosphereCanvas />

      {/* Header Sticky — Siempre visible con efecto glass y acceso unificado */}
      <LandingHeader />

      {/* Botón Flotante Discreto de WhatsApp */}
      <FloatingWhatsAppButton />

      <main className="relative z-10 pt-20 sm:pt-24">
        {/* ====================================================================
            SECCIÓN 1 — HERO: ALTO IMPACTO COMERCIAL ORIENTADO AL DUEÑO
            ==================================================================== */}
        <section className="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:pt-12 lg:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Columna Izquierda: Mensaje Comercial Dominante */}
            <div className="space-y-6 lg:col-span-7">
              <div className="animate-bo-reveal-1 inline-flex flex-wrap items-center gap-2.5 rounded-full border border-[#FF2E63]/40 bg-[#FF2E63]/12 px-4 py-1.5 text-xs font-black tracking-widest text-[#FF2E63] uppercase shadow-[0_0_30px_rgba(255,46,99,0.25)]">
                <Sparkles className="h-3.5 w-3.5 text-[#00F0FF]" />
                <span>Plataforma SaaS para Boliches y Bares</span>
              </div>

              <h1 className="animate-bo-reveal-2 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-[4.15rem] lg:leading-[1.03]">
                Tu boliche.{' '}
                <span className="block bg-gradient-to-r from-[#FF2E63] via-[#FF7597] to-[#00F0FF] bg-clip-text text-transparent">
                  Una nueva forma de vivir la noche.
                </span>
              </h1>

              <p className="animate-bo-reveal-3 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-xl">
                Digitalizá tus pedidos, agilizá la atención en barra y ofrecé a tus clientes una experiencia que va más allá de la pista. Tus clientes eligen y pagan desde el celular; tu equipo solo entrega con validación QR en segundos.
              </p>

              {/* CTAs Comerciales Principales */}
              <div className="animate-bo-reveal-4 flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#contacto"
                  className="bo-btn-laser inline-flex items-center gap-3 rounded-2xl bg-[#FF2E63] px-7 py-4 text-sm font-black tracking-wider text-white uppercase shadow-[0_0_35px_rgba(255,46,99,0.55)] transition-transform hover:scale-105 active:scale-95"
                >
                  <span>Quiero BarraOnline</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <a
                  href="#como-funciona"
                  className="bo-gpu-transition inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/[0.05] px-6 py-4 text-sm font-extrabold tracking-wider text-slate-100 uppercase backdrop-blur-md hover:border-[#00F0FF]/50 hover:bg-white/10"
                >
                  <QrCode className="h-4 w-4 text-[#00F0FF]" />
                  <span>Descubrir cómo funciona</span>
                </a>
              </div>

              {/* Pilares Comerciales Inmediatos */}
              <div className="animate-bo-reveal-4 grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-[#FF2E63]/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#FF2E63] uppercase">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Sin colas</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Tus clientes piden desde el celular sin abandonar la pista.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-emerald-400/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-400 uppercase">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>Mercado Pago</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Cobros directos e instantáneos a la cuenta del boliche.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-[#00F0FF]/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-[#00F0FF] uppercase">
                    <QrCode className="h-3.5 w-3.5 shrink-0" />
                    <span>Entrega QR</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    El barman escanea el código en 3 segundos y entrega la bebida.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-sm transition hover:border-amber-400/40">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-400 uppercase">
                    <Store className="h-3.5 w-3.5 shrink-0" />
                    <span>Marca Blanca</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300 leading-snug">
                    Tu nombre, tus colores y tu carta personalizada en cada pantalla.
                  </p>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Demostración Visual del Producto (Escenario 3D interactivo) */}
            <div className="lg:col-span-5">
              <HeroInteractiveStage />
            </div>
          </div>
        </section>

        {/* ====================================================================
            CINTA CINÉTICA DE MARCA (MARQUEE)
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
            SECCIÓN 2 — EL PROBLEMA QUE RESOLVEMOS
            ==================================================================== */}
        <section
          id="problema"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl space-y-3">
                <span className="text-xs font-black tracking-widest text-[#FF2E63] uppercase">
                  El cuello de botella de la noche
                </span>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Las filas en barra le quitan ritmo a la fiesta y ventas a tu negocio.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">
                Entre las 2:00 y las 4:30 AM la demanda explota. BarraOnline no promete milagros: te da una herramienta concreta para organizar los pedidos, descomprimir las barras y agilizar cada despacho.
              </p>
            </div>
          </ScrollReveal>

          {/* Comparativa Visual: Barra Tradicional vs. BarraOnline */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Bloque Izquierdo: La Operación Tradicional */}
            <ScrollReveal className="lg:col-span-6" direction="left">
              <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[2.25rem] border border-rose-500/25 bg-gradient-to-b from-[#180C14]/90 to-[#0A070D]/95 p-6 sm:p-9 shadow-[0_20px_50px_rgba(244,63,94,0.1)]">
                <div className="space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-black tracking-wider text-rose-400 uppercase">
                    ✕ La barra tradicional
                  </div>

                  <h3 className="text-2xl font-black text-white sm:text-3xl">
                    Demoras, pedidos perdidos y desconexión con la música
                  </h3>

                  <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <span className="text-rose-400 font-bold shrink-0">✕</span>
                      <span><strong>Doble fila agotadora:</strong> el cliente hace 20 minutos de cola en caja para pagar y luego otra fila para que lo atiendan en barra.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-rose-400 font-bold shrink-0">✕</span>
                      <span><strong>Tickets de papel húmedos:</strong> comprobantes que se rompen, se pierden en la pista o generan discusiones en la entrega.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-rose-400 font-bold shrink-0">✕</span>
                      <span><strong>Cobros lentos en la oscuridad:</strong> manipulación de billetes o terminales POS que pierden señal justo en el momento de mayor consumo.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-rose-400 font-bold shrink-0">✕</span>
                      <span><strong>Ventas no concretadas:</strong> clientes que deciden no consumir más tragos porque prefieren no perder el lugar con sus amigos.</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 border-t border-rose-500/20 pt-4 text-xs text-rose-300/80">
                  Resultado: frustración en los clientes y cuellos de botella en la operación.
                </div>
              </div>
            </ScrollReveal>

            {/* Bloque Derecho: Con BarraOnline */}
            <ScrollReveal className="lg:col-span-6" direction="right">
              <div className="bo-glass-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2.25rem] border border-emerald-500/35 bg-gradient-to-b from-[#0A1A18]/90 to-[#070E14]/95 p-6 sm:p-9 shadow-[0_20px_50px_rgba(16,185,129,0.15)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl"
                />

                <div className="relative z-10 space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-300 uppercase">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Con BarraOnline en tu boliche</span>
                  </div>

                  <h3 className="text-2xl font-black text-white sm:text-3xl">
                    Flujo directo, consumo ágil y retiro en barra con QR
                  </h3>

                  <ul className="space-y-3.5 text-xs sm:text-sm text-slate-200">
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Pedidos desde el celular:</strong> el cliente explora la carta digital y elige sus bebidas sin moverse de la pista.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Pago digital directo:</strong> abona en segundos con Mercado Pago con dinero en cuenta o tarjetas registradas.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>QR único infalsificable:</strong> el cliente se acerca al mostrador de entrega, muestra el código y retira al instante.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <span><strong>Bármanes 100% enfocados:</strong> el personal no cobra ni hace cuentas en la oscuridad; solo prepara y despacha rápido.</span>
                    </li>
                  </ul>
                </div>

                <div className="relative z-10 mt-8 border-t border-emerald-500/20 pt-4 flex items-center justify-between">
                  <span className="text-xs text-emerald-300 font-bold">
                    Resultado: barras más ordenadas y clientes que consumen más cómodos.
                  </span>
                  <a
                    href="#como-funciona"
                    className="inline-flex items-center gap-1 text-xs font-black text-[#00F0FF] uppercase hover:underline"
                  >
                    Ver el recorrido
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* ====================================================================
            SECCIÓN 3 — ASÍ FUNCIONA (EL RECORRIDO EN 4 PASOS)
            ==================================================================== */}
        <section
          id="como-funciona"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-12 max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FF2E63]/35 bg-[#FF2E63]/10 px-3.5 py-1 text-xs font-black tracking-widest text-[#FF2E63] uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                Experiencia en cuatro pasos
              </span>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                ¿Cómo funciona BarraOnline?
              </h2>
              <p className="text-base text-slate-300 sm:text-lg">
                Una secuencia intuitiva diseñada para que cualquier cliente pueda pedir en menos de un minuto, sin instalar aplicaciones pesadas ni perder tiempo en la caja.
              </p>
            </div>
          </ScrollReveal>

          {/* Simulador Interactivo Paso a Paso */}
          <ScrollReveal delayMs={100}>
            <LiveOrderJourneySimulator />
          </ScrollReveal>
        </section>

        {/* ====================================================================
            SECCIÓN 4 — BENEFICIOS PARA TU BOLICHE
            ==================================================================== */}
        <section
          id="beneficios"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-2xl space-y-3">
                <span className="text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  Ventajas estratégicas
                </span>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Diseñado para profesionalizar la venta nocturna.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">
                Combiná agilidad operativa en barra con una experiencia digital moderna que tus clientes van a valorar desde la primera noche.
              </p>
            </div>
          </ScrollReveal>

          {/* Bento Asimétrico de Beneficios Comerciales */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Beneficio 1 (Grande, 7 columnas): Experiencia Moderna */}
            <ScrollReveal className="lg:col-span-7" direction="left">
              <div className="bo-glass-panel relative flex h-full flex-col justify-between overflow-hidden rounded-[2.25rem] p-6 sm:p-9">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#FF2E63]/20 blur-3xl"
                />

                <div className="relative z-10 space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF2E63]/20 text-[#FF2E63]">
                    <Zap className="h-6 w-6" />
                  </div>
                  <span className="text-[11px] font-black tracking-widest text-[#FF2E63] uppercase">
                    EXPERIENCIA EN PISTA
                  </span>
                  <h3 className="text-2xl font-black text-white sm:text-3xl">
                    Tus clientes disfrutan más de la música y menos de las filas
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Al permitir que tus clientes elijan y abonen desde cualquier rincón del establecimiento, eliminás el estrés de esperar amontonados en la caja. La noche se vuelve más fluida y el consumo aumenta de forma natural.
                  </p>
                </div>

                <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5">
                  <div>
                    <span className="block text-2xl font-black text-[#00F0FF] sm:text-3xl">
                      3 a 5 seg
                    </span>
                    <span className="text-xs text-slate-400">
                      Tiempo promedio de validación QR en barra.
                    </span>
                  </div>
                  <div>
                    <span className="block text-2xl font-black text-[#FF2E63] sm:text-3xl">
                      100%
                    </span>
                    <span className="text-xs text-slate-400">
                      Pedidos abonados antes de ser despachados.
                    </span>
                  </div>
                </div>
              </div>
            </ScrollReveal>

            {/* Beneficios 2 y 3 (Columna derecha, 5 columnas apiladas) */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <ScrollReveal delayMs={100} direction="right">
                <div className="bo-glass-panel relative overflow-hidden rounded-[2.25rem] p-6 sm:p-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[#00F0FF]/20 blur-2xl"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black tracking-widest text-[#00F0FF] uppercase">
                        COBROS DIRECTOS
                      </span>
                      <CreditCard className="h-5 w-5 text-[#00F0FF]" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                      Acreditación inmediata en tu Mercado Pago
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      El dinero de cada trago o combo VIP se acredita directamente en la cuenta de Mercado Pago de tu boliche. Sin intermediaciones demoradas ni retenciones arbitrarias.
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal delayMs={200} direction="right">
                <div className="bo-glass-panel relative overflow-hidden rounded-[2.25rem] p-6 sm:p-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-purple-500/20 blur-2xl"
                  />
                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black tracking-widest text-purple-300 uppercase">
                        CONTROL EN VIVO
                      </span>
                      <BarChart3 className="h-5 w-5 text-purple-300" />
                    </div>
                    <h3 className="text-xl font-black text-white">
                      Sabé qué bebidas tenés y evitá vender agotados
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                      Tu carta digital sincroniza el stock en tiempo real. Cuando una botella o combo se agota, el sistema lo bloquea automáticamente para evitar quejas en barra.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECCIÓN 5 — TU BOLICHE, TU IDENTIDAD (MARCA BLANCA)
            ==================================================================== */}
        <section
          id="para-boliches"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <ScrollReveal>
            <div className="mb-12 max-w-3xl space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/35 bg-purple-500/10 px-3.5 py-1 text-xs font-black tracking-widest text-purple-300 uppercase">
                <Store className="h-3.5 w-3.5" />
                Personalización Integral
              </span>
              <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                Tu boliche, tu identidad.
              </h2>
              <p className="text-base text-slate-300 sm:text-lg">
                Cada establecimiento tiene su propia esencia, su música y su estética. BarraOnline se adapta por completo a la marca de tu local.
              </p>
            </div>
          </ScrollReveal>

          {/* Demostración Interactiva de Marca Blanca */}
          <ScrollReveal delayMs={100}>
            <BrandIdentityShowcase />
          </ScrollReveal>
        </section>

        {/* ====================================================================
            SECCIÓN 6 — BOLICHES ADHERIDOS (DATOS REALES DEL BACKEND)
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
                  <span>Establecimientos Habilitados en la Plataforma</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Boliches Adheridos
                </h2>
                <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                  Establecimientos que ya operan con su carta digital activa en BarraOnline. Accedé a cada experiencia para conocer cómo funciona su servicio en vivo.
                </p>
              </div>

              <div className="bo-glass-pill inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 text-xs font-bold text-emerald-300 lg:self-auto">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_12px_#10B981]" />
                <span>Cartas digitales sincronizadas en tiempo real</span>
              </div>
            </div>
          </ScrollReveal>

          {/* Renderizado de Boliches Habilitados desde la Base de Datos */}
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
                  accentSecondary={tenant.theme_config?.accentSecondary || '#00F0FF'}
                  accentOnPrimary={tenant.theme_config?.accentOnPrimary || '#FFFFFF'}
                  heroBadge={tenant.theme_config?.heroBadge || 'BOLICHE ADHERIDO'}
                  tagline={
                    tenant.theme_config?.tagline ||
                    'Pedí tus bebidas desde el celular, pagá seguro y retirá con QR sin hacer filas.'
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
            SECCIÓN 7 — CONVERTITE EN UN BOLICHE ADHERIDO (CONVERSIÓN ALTA)
            ==================================================================== */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <ScrollReveal direction="scale">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-[#12162A] via-[#0B0D18] to-[#1A0F26] p-8 sm:p-12 lg:p-16 shadow-[0_30px_90px_rgba(0,0,0,0.85)]">
              {/* Luces de Escenario Ambientales */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-32 right-10 h-96 w-96 rounded-full bg-[#00F0FF]/15 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-32 left-10 h-96 w-96 rounded-full bg-[#FF2E63]/15 blur-3xl"
              />

              <div className="relative z-10 max-w-3xl space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-1 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF2E63]" />
                  Sumá tu establecimiento
                </span>

                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
                  Llevá tu boliche al siguiente nivel.
                </h2>

                <p className="text-base leading-relaxed text-slate-300 sm:text-lg">
                  Queremos conocer tu establecimiento y mostrarte cómo BarraOnline puede ayudarte a transformar la experiencia de tus clientes, agilizar la atención en barra y profesionalizar la operación nocturna.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <a
                    href="#contacto"
                    className="bo-btn-laser inline-flex items-center gap-2.5 rounded-2xl bg-[#FF2E63] px-7 py-4 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_30px_rgba(255,46,99,0.55)] transition-transform hover:scale-105 active:scale-95"
                  >
                    <span>Solicitar información</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <a
                    href={WHATSAPP_DIRECT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-4 text-xs font-black tracking-wider text-emerald-300 uppercase backdrop-blur-md hover:bg-emerald-500/20 hover:border-emerald-400 transition-all"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-400" />
                    <span>Hablar por WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* ====================================================================
            SECCIÓN 8 — CONTACTO Y SOLICITUD DE INFORMACIÓN (FORMULARIO + WHATSAPP)
            ==================================================================== */}
        <section
          id="contacto"
          className="mx-auto max-w-7xl scroll-mt-28 px-4 py-20 sm:px-6"
        >
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
            {/* Columna Izquierda: Mensaje y WhatsApp Directo */}
            <div className="space-y-6 lg:col-span-5">
              <ScrollReveal>
                <div className="space-y-3">
                  <span className="text-xs font-black tracking-widest text-[#FF2E63] uppercase">
                    Canales directos de consulta
                  </span>
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Hablemos de tu establecimiento.
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-300">
                    Estamos disponibles para responder tus preguntas técnicas, coordinar una demostración en vivo del sistema de barra y armar una propuesta a medida para tu local.
                  </p>
                </div>
              </ScrollReveal>

              {/* Tarjeta de Contacto Directo por WhatsApp */}
              <ScrollReveal delayMs={100}>
                <div className="rounded-3xl border border-emerald-500/35 bg-gradient-to-b from-[#0A1A17]/80 to-[#050D0C]/90 p-6 backdrop-blur-xl shadow-[0_15px_40px_rgba(16,185,129,0.15)] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 shadow-[0_0_20px_#10B981]">
                      <MessageCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
                        ATENCIÓN COMERCIAL INMEDIATA
                      </span>
                      <h3 className="text-lg font-black text-white">
                        WhatsApp Directo
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Escribinos directo a nuestra línea comercial. Respondemos tus consultas al instante:
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 text-center">
                    <span className="block text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Línea comercial Argentina
                    </span>
                    <strong className="text-lg font-black text-white tracking-wider sm:text-xl">
                      +54 9 223 623-7874
                    </strong>
                  </div>

                  <a
                    href={WHATSAPP_DIRECT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-black uppercase text-slate-950 transition-all hover:bg-emerald-400 active:scale-95 shadow-[0_0_24px_rgba(16,185,129,0.4)]"
                  >
                    <span>Iniciar conversación por WhatsApp</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </ScrollReveal>
            </div>

            {/* Columna Derecha: Formulario Comercial Profesional */}
            <div className="lg:col-span-7">
              <ScrollReveal delayMs={120}>
                <CommercialContactForm />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECCIÓN 9 — CTA FINAL
            ==================================================================== */}
        <section className="mx-auto max-w-7xl px-4 pt-4 pb-20 sm:px-6">
          <ScrollReveal>
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-[#0A0C14]/90 px-6 py-14 text-center sm:px-12 sm:py-20 shadow-[0_20px_70px_rgba(0,0,0,0.8)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,46,99,0.22),rgba(0,240,255,0.08)_45%,transparent_75%)]"
              />
              <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-black tracking-widest text-[#00F0FF] uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF2E63]" />
                  Transformá la noche de tu boliche
                </span>

                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  La próxima gran experiencia de tu boliche empieza acá.
                </h2>

                <p className="text-sm text-slate-300 sm:text-base leading-relaxed">
                  Conocé una nueva forma de gestionar los pedidos y ofrecer una experiencia digital a tus clientes.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  <a
                    href="#contacto"
                    className="bo-btn-laser inline-flex items-center gap-3 rounded-2xl bg-[#FF2E63] px-8 py-4 text-xs font-black tracking-wider text-white uppercase shadow-[0_0_35px_rgba(255,46,99,0.55)] transition-transform hover:scale-105 active:scale-95"
                  >
                    <span>Quiero sumar mi boliche</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <a
                    href={WHATSAPP_DIRECT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 py-4 text-xs font-black tracking-wider text-slate-100 uppercase backdrop-blur-md hover:bg-white/10 transition-all"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-400" />
                    <span>Consultar por WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      {/* ====================================================================
          FOOTER PROFESIONAL Y LIMPIO
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
              <a href="#como-funciona" className="hover:text-slate-300 transition">
                Cómo Funciona
              </a>
              <span>•</span>
              <a href="#beneficios" className="hover:text-slate-300 transition">
                Beneficios
              </a>
              <span>•</span>
              <a href="#para-boliches" className="hover:text-slate-300 transition">
                Para tu Boliche
              </a>
              <span>•</span>
              <a href="#contacto" className="hover:text-slate-300 transition">
                Contacto Comercial
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
