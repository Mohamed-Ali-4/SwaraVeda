import { useEffect, useRef } from 'react';

/**
 * The cover's background: lines of sound across the page that swell around the
 * pointer (or a slow drifting point on touch screens), drawn in the colour of
 * whichever script the logo is showing.
 */
export default function VoiceField({ color }: { color: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tint = useRef(color);
  tint.current = color;

  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    let px = 0.5, py = 0.45, tx = 0.5, ty = 0.45; // pointer, smoothed, as fractions of the page
    let energy = 0.4, target = 0.4;
    let pointed = false;
    let shown = hexToRgb(tint.current);

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      pointed = true;
      tx = e.clientX / w;
      ty = e.clientY / h;
      target = 1;
    };
    const leave = () => { pointed = false; target = 0.4; };

    const LINES = 9;
    const draw = (t: number) => {
      const s = t / 1000;
      if (!pointed) {
        tx = 0.5 + Math.sin(s * 0.23) * 0.3;
        ty = 0.45 + Math.cos(s * 0.31) * 0.2;
      }
      px += (tx - px) * 0.06;
      py += (ty - py) * 0.06;
      energy += (target - energy) * 0.03;
      if (pointed) target = Math.max(0.55, target - 0.004);
      const want = hexToRgb(tint.current);
      shown = shown.map((c, k) => c + (want[k] - c) * 0.08) as [number, number, number];
      const [r, g, b] = shown.map(Math.round);

      ctx.clearRect(0, 0, w, h);
      for (let l = 0; l < LINES; l++) {
        const base = h * (0.12 + (l / (LINES - 1)) * 0.76);
        const near = Math.exp(-(((base / h) - py) ** 2) / 0.02);
        const alpha = 0.05 + near * 0.22 * energy;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const dx = x / w - px;
          const swell = Math.exp(-(dx * dx) / 0.012) * near;
          const amp = 3 + 46 * swell * energy;
          const y = base
            + Math.sin(x * 0.018 + s * 2.1 + l) * amp * 0.6
            + Math.sin(x * 0.047 - s * 3.3 + l * 1.7) * amp * 0.4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.2 + near * 0.8;
        ctx.stroke();
      }
      if (!still) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move);
    document.documentElement.addEventListener('pointerleave', leave);
    raf = requestAnimationFrame(draw);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
