import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// "Swara" (voice, musical note) in the scripts of India's languages, each
// with its own colour so every change reads as a new voice.
const SWARA = [
  { text: 'Swara', lang: 'en', name: 'English', font: 'Nunito', color: '#FFB224' },
  { text: 'स्वर', lang: 'hi', name: 'Hindi', font: 'Noto Sans Devanagari', color: '#FF7A2F' },
  { text: 'ஸ்வர', lang: 'ta', name: 'Tamil', font: 'Noto Sans Tamil', color: '#FF5468' },
  { text: 'స్వర', lang: 'te', name: 'Telugu', font: 'Noto Sans Telugu', color: '#2EE6C5' },
  { text: 'ಸ್ವರ', lang: 'kn', name: 'Kannada', font: 'Noto Sans Kannada', color: '#FFD23F' },
  { text: 'സ്വര', lang: 'ml', name: 'Malayalam', font: 'Noto Sans Malayalam', color: '#5BE37D' },
  { text: 'স্বর', lang: 'bn', name: 'Bengali', font: 'Noto Sans Bengali', color: '#47C4FF' },
  { text: 'સ્વર', lang: 'gu', name: 'Gujarati', font: 'Noto Sans Gujarati', color: '#FF9A3D' },
  { text: 'ସ୍ୱର', lang: 'or', name: 'Odia', font: 'Noto Sans Oriya', color: '#3BE0D0' },
  { text: 'ਸਵਰ', lang: 'pa', name: 'Punjabi', font: 'Noto Sans Gurmukhi', color: '#FFE45C' },
];

const HOLD_MS = 1000; // how long each script stays on screen
const BURST = [10, 18, 30, 46, 64, 82, 96, 82, 64, 46, 30, 18, 10];

function Burst({ x, delay }: { x: number; delay: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {BURST.map((h, i) => (
        <rect
          key={i}
          x={i * 7 - (BURST.length * 7) / 2}
          y={-h / 2}
          width={3.2}
          height={h}
          rx={1.6}
          className="sv-bar"
          style={{ animationDelay: `${delay + i * 0.07}s` }}
        />
      ))}
    </g>
  );
}

/**
 * The SwaraVeda wordmark: "Swara" rolls through India's scripts, each in its
 * own colour, while "Veda" stays put over a voice wave that jumps with every
 * change.
 */
export default function BrandLogo({ size = 'lg', tagline = true, onAccent }: {
  size?: 'md' | 'lg'; tagline?: boolean; onAccent?: (color: string) => void;
}) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const measure = useRef<HTMLSpanElement>(null);
  const wave = useRef<SVGGElement>(null);

  const show = (n: number) => {
    if (n === i) return;
    setPrev(i);
    setI(n);
  };

  // Next script every second, always (with reduced motion it still changes, just without the animation).
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPrev(i);
      setI((i + 1) % SWARA.length);
    }, HOLD_MS);
    return () => window.clearTimeout(t);
  }, [i]);

  useEffect(() => onAccent?.(SWARA[i].color), [i, onAccent]);

  // Each script is a different width; measure them once the fonts are in so
  // the gap before "Veda" can glide instead of jump.
  useLayoutEffect(() => {
    const read = () => {
      const el = measure.current;
      if (el) setWidths(Array.from(el.children, (c) => (c as HTMLElement).getBoundingClientRect().width));
    };
    read();
    document.fonts?.ready.then(read);
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [size]);

  // Kick the voice wave on every change.
  useEffect(() => {
    if (prev === null) return;
    wave.current?.animate(
      [{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.45)' }, { transform: 'scaleY(1)' }],
      { duration: 500, easing: 'cubic-bezier(.3,1.6,.5,1)' },
    );
  }, [i, prev]);

  const swara = SWARA[i];
  const big = size === 'lg';
  const width = widths[i];

  return (
    <div className="sv-root relative select-none" style={{ ['--sv' as string]: swara.color }}>
      <style>{`
        @property --sv { syntax: '<color>'; inherits: true; initial-value: #FFB224; }
        .sv-root { transition: --sv .5s ease; }
        @keyframes sv-pulse { 0%, 100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
        .sv-bar { fill: var(--sv); opacity: .5; transform-box: fill-box; transform-origin: center; animation: sv-pulse 1.8s ease-in-out infinite; }
        .sv-stop { stop-color: var(--sv); }
        @keyframes sv-pop {
          0% { opacity: 0; transform: translateY(.55em) scale(.7); filter: blur(10px) }
          55% { opacity: 1; filter: blur(0) }
          75% { transform: translateY(-.04em) scale(1.08) }
          100% { opacity: 1; transform: none; filter: none }
        }
        @keyframes sv-out {
          to { opacity: 0; transform: translateY(-.5em) scale(.92); filter: blur(8px) }
        }
        .sv-in { animation: sv-pop .55s cubic-bezier(.2,.8,.2,1) both; }
        .sv-out { animation: sv-out .3s cubic-bezier(.4,0,.2,1) both; }
        .sv-slot { transition: width .45s cubic-bezier(.65,0,.35,1); }
        @keyframes sv-flash { 0% { opacity: .9; transform: scale(.6) } 100% { opacity: 0; transform: scale(1.6) } }
        .sv-flash { animation: sv-flash .9s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .sv-bar, .sv-in, .sv-out, .sv-flash { animation: none } .sv-slot { transition: none } }
      `}</style>

      <div className="relative">
        {/* Soft halo in the current script's colour. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-[28rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[70px]"
          style={{ background: 'var(--sv)' }}
        />

        <h1
          onClick={() => show((i + 1) % SWARA.length)}
          title="Click for the next language"
          className={`relative flex cursor-pointer items-baseline justify-center gap-[0.22em] font-extrabold tracking-tight text-white ${
            big ? 'text-[3.4rem] sm:text-[4.6rem]' : 'text-4xl'
          }`}
          style={{ fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif', lineHeight: 1.3 }}
          aria-label="SwaraVeda"
        >
          <span
            className="sv-slot relative inline-grid items-baseline justify-items-end"
            style={{ width: width ? `${width}px` : '2.9em' }}
            aria-hidden="true"
          >
            <span
              key={`flash-${i}`}
              className="sv-flash pointer-events-none absolute left-1/2 top-1/2 h-[1.8em] w-[1.8em] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${swara.color}66 0%, transparent 65%)` }}
            />
            <span
              key={`in-${i}`}
              lang={swara.lang}
              className="sv-in whitespace-nowrap"
              style={{
                gridArea: '1 / 1',
                fontFamily: `'${swara.font}', Nunito, sans-serif`,
                color: swara.color,
                textShadow: `0 0 26px ${swara.color}66`,
              }}
            >
              {swara.text}
            </span>
          </span>
          <span aria-hidden="true" style={{ textShadow: '0 0 30px rgba(255,255,255,.18)' }}>Veda</span>
        </h1>

        <svg
          className="relative mx-auto mt-1 block w-full max-w-[26rem] pointer-events-none"
          viewBox="0 0 600 110"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ height: big ? '3.2rem' : '2.2rem' }}
        >
          <defs>
            <linearGradient id="sv-line" x1="0" x2="1">
              <stop offset="0%" className="sv-stop" stopOpacity="0" />
              <stop offset="20%" className="sv-stop" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity=".55" />
              <stop offset="80%" className="sv-stop" />
              <stop offset="100%" className="sv-stop" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="55" x2="600" y2="55" stroke="url(#sv-line)" strokeWidth="1.6" />
          <g transform="translate(0 55)">
            <g ref={wave} style={{ transformOrigin: '0 0' }}>
              <Burst x={300} delay={0} />
            </g>
          </g>
        </svg>

        {/* Hidden copies of every script, only to measure their widths. */}
        <span
          ref={measure}
          aria-hidden="true"
          className={`pointer-events-none invisible absolute left-0 top-0 flex font-extrabold tracking-tight ${
            big ? 'text-[3.4rem] sm:text-[4.6rem]' : 'text-4xl'
          }`}
        >
          {SWARA.map((s) => (
            <span key={s.lang} className="whitespace-nowrap" style={{ fontFamily: `'${s.font}', Nunito, sans-serif` }}>{s.text}</span>
          ))}
        </span>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2.5">
        <p aria-hidden="true" key={swara.lang} className="sv-in text-xs font-bold uppercase tracking-[0.3em]" style={{ color: swara.color }}>
          {swara.name}
        </p>
        <div className="flex gap-0.5">
          {SWARA.map((s, n) => (
            <button
              key={s.lang}
              type="button"
              onClick={() => show(n)}
              aria-label={`Show Swara in ${s.name}`}
              className="group flex h-4 items-center px-[3px]"
            >
              <span
                className="block h-1 rounded-full transition-all duration-500 group-hover:h-1.5"
                style={{ width: n === i ? 22 : 6, background: n === i ? swara.color : 'rgba(255,255,255,.22)' }}
              />
            </button>
          ))}
        </div>
      </div>
      {tagline && (
        <p
          className={`mt-5 text-center text-white/85 ${big ? 'text-xl sm:text-2xl' : 'text-base'}`}
          style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}
        >
          <span className="font-extrabold transition-colors duration-700" style={{ color: swara.color }}>Vani:</span>{' '}
          Preserving Voices, Empowering Generations
        </p>
      )}
    </div>
  );
}
