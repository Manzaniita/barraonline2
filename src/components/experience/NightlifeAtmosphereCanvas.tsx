'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  z: number; // 0.2 (lejos) a 1.0 (cerca)
  radius: number;
  baseAlpha: number;
  speedY: number;
  driftPhase: number;
  driftSpeed: number;
  color: string;
}

interface PlasmaOrb {
  xRatio: number;
  yRatio: number;
  radius: number;
  colorInner: string;
  colorOuter: string;
  phase: number;
  speed: number;
  parallaxFactor: number;
}

const COLORS = ['#FF2E63', '#00F0FF', '#A855F7', '#FF6B9D', '#00F5D4'];

export function NightlifeAtmosphereCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const pointer = {
      x: width * 0.5,
      y: height * 0.35,
      targetX: width * 0.5,
      targetY: height * 0.35,
      active: false,
    };

    let scrollY = window.scrollY || 0;

    // Inicializamos partículas suspendidas con diferentes planos Z
    const particleCount = isCoarsePointer ? 24 : 52;
    const particles: Particle[] = Array.from({ length: particleCount }, (_, i) => {
      const z = 0.25 + ((i * 17) % 75) / 100;
      return {
        x: ((i * 137.5) % 100) * (width / 100),
        y: ((i * 73.1) % 100) * (height / 100),
        z,
        radius: (0.8 + z * 1.9) * (isCoarsePointer ? 0.85 : 1),
        baseAlpha: 0.14 + z * 0.38,
        speedY: 0.18 + z * 0.45,
        driftPhase: i * 0.9,
        driftSpeed: 0.006 + z * 0.008,
        color: COLORS[i % COLORS.length]!,
      };
    });

    // Orbes volumétricos flotantes en distintos planos
    const orbs: PlasmaOrb[] = [
      {
        xRatio: 0.18,
        yRatio: 0.22,
        radius: isCoarsePointer ? 240 : 420,
        colorInner: 'rgba(255, 46, 99, 0.16)',
        colorOuter: 'rgba(255, 46, 99, 0)',
        phase: 0.2,
        speed: 0.00055,
        parallaxFactor: 0.12,
      },
      {
        xRatio: 0.82,
        yRatio: 0.28,
        radius: isCoarsePointer ? 220 : 390,
        colorInner: 'rgba(0, 240, 255, 0.13)',
        colorOuter: 'rgba(0, 240, 255, 0)',
        phase: 2.1,
        speed: 0.00048,
        parallaxFactor: 0.18,
      },
      {
        xRatio: 0.52,
        yRatio: 0.68,
        radius: isCoarsePointer ? 260 : 460,
        colorInner: 'rgba(139, 92, 246, 0.12)',
        colorOuter: 'rgba(139, 92, 246, 0)',
        phase: 4.0,
        speed: 0.0004,
        parallaxFactor: 0.08,
      },
    ];

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (isCoarsePointer) return;
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
      pointer.active = true;
    };

    const handleScroll = () => {
      scrollY = window.scrollY || 0;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let rafId = 0;
    let time = 0;

    const renderFrame = (timestamp: number) => {
      time = timestamp;
      ctx.clearRect(0, 0, width, height);

      // Suavizado LERP para el puntero
      pointer.x += (pointer.targetX - pointer.x) * 0.06;
      pointer.y += (pointer.targetY - pointer.y) * 0.06;

      const cursorOffsetX = (pointer.x / Math.max(width, 1) - 0.5) * 2;
      const cursorOffsetY = (pointer.y / Math.max(height, 1) - 0.5) * 2;

      // 1. Orbes volumétricos flotantes con parallax de scroll y cursor
      for (const orb of orbs) {
        const oscX = Math.sin(time * orb.speed + orb.phase) * 70;
        const oscY = Math.cos(time * orb.speed * 0.85 + orb.phase) * 50;
        const scrollShift = ((scrollY * orb.parallaxFactor) % (height * 0.6));

        const cx =
          width * orb.xRatio +
          oscX -
          cursorOffsetX * 35 * (orb.parallaxFactor * 5);
        const cy =
          height * orb.yRatio +
          oscY -
          scrollShift * 0.35 -
          cursorOffsetY * 25;

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb.radius);
        grad.addColorStop(0, orb.colorInner);
        grad.addColorStop(1, orb.colorOuter);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Haces de luz de escenario (Stage Laser Cones) en la parte superior
      const beamConfigs = [
        {
          originX: width * 0.22,
          angleBase: 0.32,
          angleSwing: 0.16,
          speed: 0.00045,
          color: '255, 46, 99',
          alpha: 0.065,
        },
        {
          originX: width * 0.5,
          angleBase: 0.0,
          angleSwing: 0.22,
          speed: 0.00038,
          color: '168, 85, 247',
          alpha: 0.05,
        },
        {
          originX: width * 0.78,
          angleBase: -0.32,
          angleSwing: 0.18,
          speed: 0.00052,
          color: '0, 240, 255',
          alpha: 0.06,
        },
      ];

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (const beam of beamConfigs) {
        const angle =
          beam.angleBase +
          Math.sin(time * beam.speed) * beam.angleSwing +
          cursorOffsetX * 0.08;
        const beamLength = Math.max(width, height) * 0.95;
        const spread = isCoarsePointer ? 130 : 220;

        const endX = beam.originX + Math.sin(angle) * beamLength;
        const endY = Math.cos(angle) * beamLength;

        const beamGrad = ctx.createLinearGradient(
          beam.originX,
          -20,
          endX,
          endY
        );
        beamGrad.addColorStop(0, `rgba(${beam.color}, ${beam.alpha * 1.6})`);
        beamGrad.addColorStop(0.45, `rgba(${beam.color}, ${beam.alpha})`);
        beamGrad.addColorStop(1, `rgba(${beam.color}, 0)`);

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(beam.originX - 18, -20);
        ctx.lineTo(beam.originX + 18, -20);
        ctx.lineTo(endX + spread, endY);
        ctx.lineTo(endX - spread, endY);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Spotlight ambiental reactivo al cursor (solo desktop)
      if (!isCoarsePointer && pointer.active) {
        const spotRadius = 320;
        const spotGrad = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          spotRadius
        );
        spotGrad.addColorStop(0, 'rgba(255, 46, 99, 0.075)');
        spotGrad.addColorStop(0.45, 'rgba(0, 240, 255, 0.035)');
        spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, spotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Onda acústica sutil en el horizonte medio
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 46, 99, 0.08)';
      ctx.lineWidth = 1.2;
      const waveYBase = height * 0.58 - (scrollY * 0.08) % (height * 0.3);
      for (let x = 0; x <= width; x += 24) {
        const y =
          waveYBase +
          Math.sin(x * 0.0045 + time * 0.0014) * 22 +
          Math.cos(x * 0.009 - time * 0.001) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 5. Partículas suspendidas en distintos planos Z
      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.y -= p.speedY;
          p.driftPhase += p.driftSpeed;
          p.x += Math.sin(p.driftPhase) * 0.35 * p.z;

          if (p.y < -20) {
            p.y = height + 20;
            p.x = Math.random() * width;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
        }

        const parallaxX = p.x - cursorOffsetX * 22 * p.z;
        const parallaxY =
          ((p.y - scrollY * 0.15 * p.z) % (height + 40) + (height + 40)) %
            (height + 40) -
          20;

        const pulse =
          p.baseAlpha * (0.7 + 0.3 * Math.sin(time * 0.002 + p.driftPhase));

        ctx.globalAlpha = pulse;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(parallaxX, parallaxY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    // Dibujamos el primer cuadro inmediatamente y continuamos si no hay reduced-motion
    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Grilla arquitectónica en perspectiva */}
      <div className="bo-stage-grid absolute inset-0 opacity-75" />

      {/* Motor Canvas de luces volumétricas, orbes y partículas */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Viñeta cinematográfica periférica para contraste impecable de textos */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_30%,rgba(4,4,7,0.75)_100%)]" />
    </div>
  );
}
