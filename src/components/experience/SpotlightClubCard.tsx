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
      rotateX: (0.5 - relY) * 5,
      rotateY: (relX - 0.5) * 5,
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
        transform: `perspective(1000px) rotateX(${spotlight.rotateX}deg) rotateY(${spotlight.rotateY}deg)`,
        transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[#0c0e18]/90 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-md"
    >
      {/* Spotlight radial que sigue al cursor suavemente */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(420px circle at ${spotlight.x}px ${spotlight.y}px, ${accentPrimary}22, transparent 70%)`,
        }}
      />

      {/* Resplandor superior sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-35"
        style={{ backgroundColor: accentPrimary }}
      />

      <div className="relative z-10 space-y-4">
        {/* Cabecera del club */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                style={{
                  borderColor: `${accentPrimary}44`,
                  backgroundColor: `${accentPrimary}15`,
                  color: accentPrimary,
                }}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
              >
                <GlassWater className="h-3 w-3" />
                {city} • {heroBadge}
              </span>

              {isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  {commercialTag || 'DESTACADO'}
                </span>
              )}
            </div>

            <h3 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {fantasyName}
            </h3>

            {address && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {address}, {city}
                </span>
              </div>
            )}
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Carta Activa</span>
          </span>
        </div>

        {/* Tagline */}
        <p className="text-sm leading-relaxed text-slate-300">
          {tagline}
        </p>

        {/* Píldoras de beneficios */}
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-200 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Carta digital online
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1">
            <QrCode
              className="h-3.5 w-3.5"
              style={{ color: accentSecondary }}
            />
            Retiro express con QR
          </span>
        </div>
      </div>

      {/* Pie con CTA hacia la carta del boliche */}
      <div className="relative z-10 mt-6 border-t border-white/[0.08] pt-4">
        <Link
          href={`/b/${slug}`}
          style={{
            backgroundColor: accentPrimary,
            color: accentOnPrimary,
          }}
          className="bo-btn-laser inline-flex w-full items-center justify-between rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] shadow-md"
        >
          <span>Abrir Carta Digital de {fantasyName}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
