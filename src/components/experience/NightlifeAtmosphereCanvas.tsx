'use client';

import React, { useEffect, useState } from 'react';

/**
 * Atmósfera Visual BarraOnline — Dirección de Arte Nocturna
 *
 * Elimina completamente cuadrículas, líneas artificiales, partículas flotantes y auroras genéricas.
 * Implementa iluminación ambiental arquitectónica localizada, viñeta cinematográfica y
 * gradientes radiales ultra-profundos que otorgan presencia nocturna y elegancia editorial.
 */
export function NightlifeAtmosphereCanvas() {
  const [mousePos, setMousePos] = useState({ x: 50, y: 25 });
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isCoarse || prefersReduced) return;

    setIsDesktop(true);

    let rafId: number | null = null;
    let targetX = 50;
    let targetY = 25;
    let currentX = 50;
    let currentY = 25;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth) * 100;
      targetY = (e.clientY / window.innerHeight) * 100;

      if (!rafId) {
        rafId = window.requestAnimationFrame(updateGlow);
      }
    };

    const updateGlow = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      setMousePos({ x: currentX, y: currentY });

      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        rafId = window.requestAnimationFrame(updateGlow);
      } else {
        rafId = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      {/* 1. Fondo Base: Negro Carbón Profundo con capas tonales */}
      <div className="absolute inset-0 bg-[#060608]" />

      {/* 2. Iluminación Ambiental Arquitectónica Localizada (Hero Stage Anchor) */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 h-[680px] w-[1100px] max-w-[95vw] opacity-35"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 35%, rgba(255, 0, 122, 0.18) 0%, rgba(18, 16, 28, 0.4) 50%, transparent 80%)',
        }}
      />

      {/* 3. Luz de Acento Profundo Lateral (Contrapeso sutil sin saturación) */}
      <div
        className="absolute top-[28%] -left-36 h-[550px] w-[550px] opacity-25"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, rgba(0, 240, 255, 0.08) 0%, transparent 65%)',
        }}
      />

      {/* 4. Iluminación Ambiental Inferior para Sección Comercial / Boliches */}
      <div
        className="absolute bottom-[-10%] right-[-5%] h-[700px] w-[700px] opacity-20"
        style={{
          background:
            'radial-gradient(circle at 60% 60%, rgba(255, 0, 122, 0.12) 0%, transparent 70%)',
        }}
      />

      {/* 5. Resplandor Interactivo Sutil al cursor (solo desktop, sumamente discreto) */}
      {isDesktop && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{
            background: `radial-gradient(600px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 0, 122, 0.035) 0%, transparent 70%)`,
          }}
        />
      )}

      {/* 6. Viñeta Cinematográfica Suave (Mantiene contraste inmaculado en lectura) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(6,6,8,0.78)_100%)]" />
    </div>
  );
}
