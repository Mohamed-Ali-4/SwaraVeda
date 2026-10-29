import { useEffect, useState } from 'react';

// "Swara" (voice, musical note) in the scripts of India's languages.
const SWARA = [
  { text: 'Swara', lang: 'en', name: 'English', font: 'Nunito' },
  { text: 'स्वर', lang: 'hi', name: 'Hindi', font: 'Noto Sans Devanagari' },
  { text: 'ஸ்வர', lang: 'ta', name: 'Tamil', font: 'Noto Sans Tamil' },
  { text: 'స్వర', lang: 'te', name: 'Telugu', font: 'Noto Sans Telugu' },
  { text: 'ಸ್ವರ', lang: 'kn', name: 'Kannada', font: 'Noto Sans Kannada' },
  { text: 'സ്വര', lang: 'ml', name: 'Malayalam', font: 'Noto Sans Malayalam' },
  { text: 'স্বর', lang: 'bn', name: 'Bengali', font: 'Noto Sans Bengali' },
  { text: 'સ્વર', lang: 'gu', name: 'Gujarati', font: 'Noto Sans Gujarati' },
  { text: 'ସ୍ୱର', lang: 'or', name: 'Odia', font: 'Noto Sans Oriya' },
  { text: 'ਸਵਰ', lang: 'pa', name: 'Punjabi', font: 'Noto Sans Gurmukhi' },
];

// Bar heights of the two voice "bursts" behind the wordmark, as in the logo.
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
          fill="url(#sv-wave)"
          className="sv-bar"
          style={{ animationDelay: `${delay + i * 0.07}s` }}
        />
      ))}
    </g>
  );
}

/**
 * The SwaraVeda wordmark: "Swara" cycles through Indian scripts every second
 * while "Veda" stays put, over a pulsing magenta-to-cyan voice wave.
 */
export default function BrandLogo({ size = 'lg', tagline = true }: { size?: 'md' | 'lg'; tagline?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % SWARA.length), 1000);
    return () => window.clearInterval(t);
  }, []);
  const swara = SWARA[i];
  const big = size === 'lg';

  return (
    <div className="relative select-none">
      <style>{`
        @keyframes sv-pulse { 0%, 100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
        .sv-bar { transform-box: fill-box; transform-origin: center; animation: sv-pulse 1.6s ease-in-out infinite; }
        @keyframes sv-in { from { opacity: 0; transform: translateY(.18em) scale(.96); filter: blur(4px) } to { opacity: 1; transform: none; filter: none } }
        .sv-word { animation: sv-in .45s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .sv-bar, .sv-word { animation: none } }
      `}</style>

      <div className="relative">
        <svg
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 w-full pointer-events-none"
          viewBox="0 0 600 110"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ height: big ? '7.5rem' : '4.5rem' }}
        >
          <defs>
            <linearGradient id="sv-wave" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#d946ef" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="sv-line" x1="0" x2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity="0" />
              <stop offset="12%" stopColor="#d946ef" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="88%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1="0" y1="55" x2="600" y2="55" stroke="url(#sv-line)" strokeWidth="1.6" />
          <g transform="translate(0 55)">
            <Burst x={150} delay={0} />
            <Burst x={460} delay={0.4} />
          </g>
        </svg>

        <h1
          className={`relative flex items-baseline justify-center gap-[0.22em] font-extrabold tracking-tight text-white ${
            big ? 'text-[3.4rem] sm:text-[4.6rem]' : 'text-4xl'
          }`}
          style={{ fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif', textShadow: '0 0 28px rgba(139,92,246,.45)' }}
          aria-label="SwaraVeda"
        >
          <span className="inline-flex min-w-[2.9em] justify-end" aria-hidden="true">
            <span key={i} lang={swara.lang} className="sv-word" style={{ fontFamily: `'${swara.font}', Nunito, sans-serif` }}>
              {swara.text}
            </span>
          </span>
          <span aria-hidden="true">Veda</span>
        </h1>
      </div>

      <p className="mt-3 text-center text-xs font-medium uppercase tracking-[0.25em] text-violet-300/70" aria-live="off">
        {swara.name}
      </p>
      {tagline && (
        <p
          className={`mt-5 text-center text-white/85 ${big ? 'text-xl sm:text-2xl' : 'text-base'}`}
          style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}
        >
          <span className="font-bold bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Vani:</span>{' '}
          Preserving Voices, Empowering Generations
        </p>
      )}
    </div>
  );
}
