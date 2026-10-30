'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  GlassWater,
  MapPin,
  QrCode,
  Sparkles,
} from 'lucide-react';

export interface ClubCardProps {
  id: string;
  slug: string;
  fantasyName: string;
  city: string;
  address: string;
  accentPrimary: string;
  accentSecondary: string;
  accentOnPrimary: string;
  heroBadge: string;
  tagline: string;
  index: number;
  isFeatured?: boolean;
  commercialTag?: string | null;
}

export function SpotlightClubCard({
  slug,
  fantasyName,
  city,
  address,
  accentPrimary,
  accentSecondary,
  accentOnPrimary,
  heroBadge,
  tagline,
  index,
  isFeatured,
  commercialTag,
}: ClubCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [spotlight, setSpotlight] = useState({
    x: 50,
    y: 50,
    opacity: 0,
    rotateX: 0,
    rotateY: 0,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relX = x / rect.width;
    const relY = y / rect.height;

    setSpotlight({
      x,
      y,
      opacity: 1,
      rotateX: (0.5 - relY) * 6,
      rotateY: (relX - 0.5) * 6,
    });
  };

  const handleMouseLeave = () => {
    setSpotlight((prev) => ({
      ...prev,
      opacity: 0,
      rotateX: 0,
      rotateY: 0,
    }));
  };

  return (
    <article
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1100px) rotateX(${spotlight.rotateX}deg) rotateY(${spotlight.rotateY}deg)`,
        transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[2.25rem] border border-white/12 bg-gradient-to-b from-[#131624]/95 to-[#090B12]/95 p-6 sm:p-8 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.8)]"
    >
      {/* Spotlight radial que sigue al cursor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(500px circle at ${spotlight.x}px ${spotlight.y}px, ${accentPrimary}26, ${accentSecondary}10 45%, transparent 75%)`,
        }}
      />

      {/* Halo superior permanente de identidad del club */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-45"
        style={{ backgroundColor: accentPrimary }}
      />

      {/* Onda acústica decorativa en el fondo de la tarjeta */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 90"
        className="pointer-events-none absolute inset-x-0 bottom-20 h-20 w-full opacity-15 transition-opacity duration-500 group-hover:opacity-30"
        preserveAspectRatio="none"
      >
        <path
          d={
            index % 2 === 0
              ? 'M0 45 Q 50 10, 100 45 T 200 45 T 300 45 T 400 45'
              : 'M0 55 Q 60 85, 120 45 T 240 40 T 360 55 T 400 35'
          }
          fill="none"
          stroke={accentPrimary}
          strokeWidth="2"
        />
        <path
          d="M0 60 Q 80 25, 160 60 T 320 60 T 400 50"
          fill="none"
          stroke={accentSecondary}
          strokeWidth="1.2"
          strokeDasharray="5 5"
        />
      </svg>

      <div className="relative z-10 space-y-5">
        {/* Cabecera del portal del boliche */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{
                  borderColor: `${accentPrimary}66`,
                  backgroundColor: `${accentPrimary}20`,
                  color: accentPrimary,
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black tracking-wider uppercase"
              >
                <GlassWater className="h-3.5 w-3.5" />
                {city} • {heroBadge}
              </span>

              {isFeatured && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-[11px] font-black tracking-wider text-amber-300 uppercase shadow-[0_0_16px_rgba(251,191,36,0.3)]">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  {commercialTag || 'DESTACADO'}
                </span>
              )}

              {!isFeatured && commercialTag && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3 py-1 text-[11px] font-black tracking-wider text-[#00F0FF] uppercase">
                  {commercialTag}
                </span>
              )}
            </div>

            <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {fantasyName}
            </h3>

            {address && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {address}, {city}
                </span>
              </div>
            )}
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wide text-emerald-300 uppercase">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Abierto hoy
          </span>
        </div>

        {/* Tagline del establecimiento */}
        <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
          {tagline}
        </p>

        {/* Píldoras de experiencia en pista */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-200">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Carta digital online
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <QrCode
              className="h-3.5 w-3.5"
              style={{ color: accentSecondary }}
            />
            Retiro express con QR
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <Sparkles
              className="h-3.5 w-3.5"
              style={{ color: accentPrimary }}
            />
            Mercado Pago directo
          </span>
        </div>
      </div>

      {/* Pie con CTA Magnético hacia la carta del boliche */}
      <div className="relative z-10 mt-7 border-t border-white/10 pt-5">
        <Link
          href={`/b/${slug}`}
          style={{
            backgroundColor: accentPrimary,
            color: accentOnPrimary,
            boxShadow: `0 12px 32px -6px ${accentPrimary}66`,
          }}
          className="bo-btn-laser flex w-full items-center justify-between rounded-2xl px-6 py-4 text-sm font-black tracking-wider uppercase"
        >
          <span>Ver carta y pedir</span>
          <span className="flex items-center gap-2 text-xs font-extrabold opacity-90">
            Entrar a la barra
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </article>
  );
}
