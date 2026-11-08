import { useEffect } from 'react';

const COLORS = ['#00f0ff', '#ff2bd6', '#39ff14', '#ffe600', '#b026ff'];

// Every tap/click anywhere sends out a neon ring and a few sparks.
// We add plain DOM nodes (not React state) so this costs nothing on re-renders;
// each node removes itself when its CSS animation ends.
export default function ClickSparks() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const spawn = (x: number, y: number) => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const make = (className: string) => {
        const el = document.createElement('span');
        el.className = className;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.style.setProperty('--c', color);
        el.addEventListener('animationend', () => el.remove());
        document.body.appendChild(el);
        return el;
      };
      make('spark-ring');
      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
        const dist = 26 + Math.random() * 22;
        const dot = make('spark-dot');
        dot.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        dot.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      }
    };

    const onPointerDown = (e: PointerEvent) => spawn(e.clientX, e.clientY);
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return null;
}
