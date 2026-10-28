import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { clock } from '../lib/format';
import type { AudioPlayer } from '../lib/player';

export interface Region {
  id: string;
  start: number;
  end: number;
  verified: boolean;
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * Waveform with transcript segments drawn as bands. Click to jump; the
 * active segment is highlighted. Without peaks (very long files), the
 * segments alone form the timeline.
 */
export default function Waveform({ player, peaks, regions, activeId, height = 76 }: {
  player: AudioPlayer; peaks: number[] | null; regions: Region[]; activeId?: string; height?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number } | null>(null);
  const totalRef = useRef(0);
  const total = player.duration || (regions.length ? regions[regions.length - 1].end : 0);
  totalRef.current = total;

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    const colors = {
      played: css('--color-saffron-500'),
      rest: css('--color-line-strong'),
      band: css('--color-sunken'),
      verified: css('--color-leaf-50'),
      active: css('--color-saffron-100'),
      head: css('--color-saffron-700'),
    };
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = box.clientWidth;
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(height * dpr);
        el.style.width = `${w}px`;
        el.style.height = `${height}px`;
      }
      const ctx = el.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const t = totalRef.current;
      const now = (player.audio.current?.currentTime ?? 0) * 1000;
      const x = (ms: number) => (t ? (ms / t) * w : 0);

      regions.forEach((r, i) => {
        ctx.fillStyle = r.id === activeId ? colors.active : r.verified ? colors.verified : i % 2 ? colors.band : 'transparent';
        ctx.fillRect(x(r.start), 0, Math.max(1, x(r.end) - x(r.start)), height);
      });

      const mid = height / 2;
      if (peaks?.length) {
        const barW = 2;
        const gap = 1;
        const count = Math.floor(w / (barW + gap));
        for (let i = 0; i < count; i++) {
          const p = peaks[Math.floor((i / count) * peaks.length)] ?? 0;
          const h = Math.max(2, p * (height - 12));
          const bx = i * (barW + gap);
          ctx.fillStyle = bx <= x(now) ? colors.played : colors.rest;
          ctx.beginPath();
          ctx.roundRect(bx, mid - h / 2, barW, h, 1);
          ctx.fill();
        }
      } else {
        regions.forEach((r) => {
          ctx.fillStyle = r.start <= now ? colors.played : colors.rest;
          ctx.beginPath();
          ctx.roundRect(x(r.start) + 1, mid - 10, Math.max(2, x(r.end) - x(r.start) - 2), 20, 4);
          ctx.fill();
        });
        if (!regions.length) {
          ctx.fillStyle = colors.rest;
          ctx.fillRect(0, mid - 1, w, 2);
          ctx.fillStyle = colors.played;
          ctx.fillRect(0, mid - 1, x(now), 2);
        }
      }

      ctx.fillStyle = colors.head;
      ctx.fillRect(Math.round(x(now)) - 1, 0, 2, height);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [peaks, regions, activeId, height, player.audio]);

  const msAt = (e: MouseEvent) => {
    const rect = wrap.current!.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return { x: e.clientX - rect.left, ms: fx * total };
  };

  return (
    <div
      ref={wrap}
      className="relative w-full cursor-pointer select-none"
      style={{ height }}
      onClick={(e) => player.seek(msAt(e).ms)}
      onMouseMove={(e) => setHover(msAt(e))}
      onMouseLeave={() => setHover(null)}
      role="slider"
      aria-label="Playback position"
      aria-valuemin={0}
      aria-valuemax={Math.round(total / 1000)}
      aria-valuenow={Math.round(player.time / 1000)}
      aria-valuetext={`${clock(player.time)} of ${clock(total)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); player.seek(player.time + 5000); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); player.seek(player.time - 5000); }
      }}
    >
      <canvas ref={canvas} className="block rounded-lg" />
      {hover && total > 0 && (
        <span
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] text-white"
          style={{ left: hover.x }}
        >
          {clock(hover.ms)}
        </span>
      )}
    </div>
  );
}
