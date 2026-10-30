'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  direction?: 'up' | 'left' | 'right' | 'scale';
}

export function ScrollReveal({
  children,
  className = '',
  delayMs = 0,
  direction = 'up',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (prefersReduced) return;

    // Solo animar si el elemento está claramente fuera del viewport inicial
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight + 80) {
      setVisible(false);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setVisible(true);
              observer.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.05, rootMargin: '120px 0px 40px 0px' }
      );

      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  const hiddenTransform =
    direction === 'left'
      ? 'translate3d(-20px, 0, 0)'
      : direction === 'right'
        ? 'translate3d(20px, 0, 0)'
        : direction === 'scale'
          ? 'translate3d(0, 12px, 0) scale(0.98)'
          : 'translate3d(0, 16px, 0)';

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0, 0, 0) scale(1)' : hiddenTransform,
        transitionProperty: 'opacity, transform',
        transitionDuration: '380ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delayMs}ms`,
        willChange: 'opacity, transform',
      }}
      className={className}
    >
      {children}
    </div>
  );
}
