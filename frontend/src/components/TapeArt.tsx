import { memo, useId, useLayoutEffect, useRef, type ReactNode, type SVGProps } from 'react';
import { hash, SCRIPT_FONTS, type ShelfDialect } from '../lib/dialectInfo';

// Screen-print inks: everything on a tape is drawn in these.
const INK = '#141414';
const COBALT = '#1F3FB0';
const CREAM = '#EEE6D3';
const CARD = '#E3D7BD';
const VERMILION = '#CF4527';
const GREEN = '#1E5E45';

// [panel, motif, name] colours. Each dialect gets one, picked from its name.
const SCHEMES = [
  { ground: COBALT, accent: VERMILION, text: CREAM },
  { ground: INK, accent: VERMILION, text: CREAM },
  { ground: CARD, accent: COBALT, text: INK },
  { ground: GREEN, accent: CREAM, text: CREAM },
  { ground: CARD, accent: VERMILION, text: INK },
  { ground: INK, accent: '#3D63E6', text: CREAM },
];

const SANS = '"Inter Tight", "Noto Sans Devanagari", system-ui, sans-serif';
const SERIF = 'Newsreader, Georgia, serif';

function look(d: ShelfDialect) {
  const h = hash(d.name);
  return { ...SCHEMES[h % SCHEMES.length], motif: (h >>> 4) % 4, seed: (h >>> 8) % 1000 };
}

function nativeFont(d: ShelfDialect) {
  return SCRIPT_FONTS[d.nativeScript] ?? SCRIPT_FONTS.Latin;
}

function graphemes(s: string) {
  try {
    return [...new Intl.Segmenter().segment(s)].length;
  } catch {
    return s.length;
  }
}

/** SVG text that squeezes itself to `max` user units if the real font runs wider. */
function FitText({ max, children, ...rest }: SVGProps<SVGTextElement> & { max: number; children: ReactNode }) {
  const ref = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      el.removeAttribute('textLength');
      el.removeAttribute('lengthAdjust');
      if (el.getComputedTextLength() > max) {
        el.setAttribute('textLength', String(max));
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
    };
    fit();
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener?.('loadingdone', fit);
    return () => {
      alive = false;
      document.fonts?.removeEventListener?.('loadingdone', fit);
    };
  }, [max, children]);
  return <text ref={ref} {...rest}>{children}</text>;
}

function Motif({ kind, seed, ground, accent, text }: { kind: number; seed: number; ground: string; accent: string; text: string }) {
  const cx = 237;
  if (kind === 0) {
    // A sun going down behind thickening bands.
    return (
      <>
        <circle cx={cx} cy={470} r={150} fill={accent} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={28} y={520 + i * 30} width={418} height={4 + i * 3.4} fill={ground} />
        ))}
        <circle cx={cx + 120} cy={330} r={9} fill={text} />
      </>
    );
  }
  if (kind === 1) {
    // Sound spreading out from one voice.
    return (
      <>
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={cx} cy={500} r={34 + i * 34} fill="none" stroke={accent} strokeWidth={i % 2 ? 5 : 11} />
        ))}
        <circle cx={cx} cy={500} r={16} fill={text} />
      </>
    );
  }
  if (kind === 2) {
    // Hills, one behind another.
    const hill = (base: number, amp: number, f: number, ph: number) => {
      let p = `M28 690 L28 ${base}`;
      for (let x = 28; x <= 446; x += 14) p += ` L${x} ${(base + amp * Math.sin(x * f + ph)).toFixed(1)}`;
      return `${p} L446 690 Z`;
    };
    return (
      <>
        <circle cx={150 + (seed % 170)} cy={370} r={56} fill={text} />
        <path d={hill(470, 34, 0.018, seed)} fill={accent} />
        <path d={hill(560, 26, 0.024, seed * 1.7)} fill={text} opacity={0.9} />
        <path d={hill(630, 20, 0.03, seed * 2.3)} fill={ground} />
      </>
    );
  }
  // A voice print: one burst of bars.
  return (
    <>
      <rect x={28} y={499} width={418} height={2} fill={text} />
      {Array.from({ length: 23 }, (_, i) => {
        const env = 1 - Math.abs(i - 11) / 13;
        const h = 24 + 300 * env * Math.abs(Math.sin(i * 0.9 + seed));
        return <rect key={i} x={46 + i * 17.2} y={500 - h / 2} width={9} height={h} rx={4.5} fill={accent} />;
      })}
    </>
  );
}

/** The front of a dialect's tape box, 474 × 900, as SVG content. */
export function CoverArt({ d }: { d: ShelfDialect }) {
  const id = 'c' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const { ground, accent, text, motif, seed } = look(d);
  const words = d.name.split(' ');
  const twoLines = d.name.length > 11 && words.length > 1;
  const lines = twoLines ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [d.name];
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = Math.max(48, Math.min(twoLines ? 92 : 124, 860 / Math.max(4, longest)));
  const nf = nativeFont(d);
  const nfs = Math.max(42, Math.min(104, 300 / Math.max(2, graphemes(d.native))));

  return (
    <g>
      <rect width={474} height={900} fill={CREAM} />
      <text x={237} y={50} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={15} letterSpacing={4.2} fill={INK}>
        A SWARAVEDA RECORDING
      </text>
      <rect x={28} y={70} width={418} height={2} fill={INK} />
      {lines.map((l, i) => (
        <FitText key={i} max={418} x={237} y={twoLines ? 92 + fs * 0.86 + i * fs * 0.9 : 118 + fs * 0.62} textAnchor="middle"
          fontFamily={SERIF} fontWeight={500} fontSize={fs} letterSpacing={-1.5} fill={INK}>
          {l}
        </FitText>
      ))}

      <defs>
        <clipPath id={id}><rect x={28} y={270} width={418} height={420} /></clipPath>
      </defs>
      <rect x={28} y={270} width={418} height={500} fill={ground} />
      <g clipPath={`url(#${id})`}>
        <Motif kind={motif} seed={seed} ground={ground} accent={accent} text={text} />
      </g>
      <rect x={28} y={690} width={418} height={3} fill={text} opacity={0.5} />
      <FitText max={370} x={52} y={752} fontFamily={`"${nf.font}", ${SANS}`} fontWeight={nf.weight} fontSize={nfs} fill={text}>
        {d.native}
      </FitText>

      <FitText max={290} x={28} y={812} fontFamily={SANS} fontWeight={600} fontSize={14} letterSpacing={2} fill={INK}>
        {(d.place || d.region || '').toUpperCase()}
      </FitText>
      <text x={28} y={858} fontFamily={SANS} fontWeight={600} fontSize={17} letterSpacing={5} fill={INK}>SWARAVEDA</text>
      <text x={446} y={812} textAnchor="end" fontFamily={SANS} fontWeight={600} fontSize={13} letterSpacing={2} fill={INK}>
        {d.iso_code ? `ISO ${d.iso_code.toUpperCase()}` : ''}
      </text>
      <rect x={350} y={826} width={96} height={44} fill="none" stroke={INK} strokeWidth={3} />
      <text x={398} y={857} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={22} letterSpacing={3} fill={INK}>VANI</text>
      {/* Worn edges. */}
      <rect width={474} height={900} fill={`url(#${id}e)`} />
      <defs>
        <linearGradient id={`${id}e`} x1="0" x2="1">
          <stop offset="0" stopColor="#3a2a10" stopOpacity=".22" />
          <stop offset=".06" stopColor="#3a2a10" stopOpacity="0" />
          <stop offset=".94" stopColor="#3a2a10" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2a10" stopOpacity=".22" />
        </linearGradient>
      </defs>
    </g>
  );
}

/** The side of a dialect's tape box, 142 × 840, as SVG content. */
export function SpineArt({ d }: { d: ShelfDialect }) {
  const id = 's' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const { ground, accent, text } = look(d);
  const nf = nativeFont(d);
  const showNative = d.native.toLowerCase() !== d.name.toLowerCase();
  return (
    <g>
      <rect width={142} height={840} fill={CREAM} />
      <rect width={142} height={150} fill={ground} />
      <circle cx={71} cy={70} r={36} fill={accent} />
      <rect x={18} y={108} width={106} height={4} fill={text} opacity={0.8} />
      <rect x={30} y={120} width={82} height={4} fill={text} opacity={0.6} />
      <FitText max={showNative ? 300 : 480} transform={`translate(${showNative ? 58 : 71} 180) rotate(90)`} dominantBaseline="central"
        fontFamily={SERIF} fontWeight={500} fontSize={58} letterSpacing={-0.5} fill={INK}>
        {d.name}
      </FitText>
      {showNative && (
        <FitText max={170} transform="translate(112 480) rotate(90)" dominantBaseline="central"
          fontFamily={`"${nf.font}", ${SANS}`} fontWeight={nf.weight} fontSize={30} fill={INK}>
          {d.native}
        </FitText>
      )}
      <rect x={18} y={680} width={106} height={2} fill={INK} />
      <text x={71} y={714} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={15} letterSpacing={3.5} fill={INK}>SWARA</text>
      <text x={71} y={735} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={15} letterSpacing={3.5} fill={INK}>VEDA</text>
      <rect x={29} y={762} width={84} height={40} fill="none" stroke={INK} strokeWidth={3} />
      <text x={71} y={790} textAnchor="middle" fontFamily={SANS} fontWeight={600} fontSize={20} letterSpacing={2.5} fill={INK}>VANI</text>
      <rect width={142} height={840} fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="0" x2="1">
          <stop offset="0" stopColor="#3a2a10" stopOpacity=".28" />
          <stop offset=".14" stopColor="#3a2a10" stopOpacity="0" />
          <stop offset=".86" stopColor="#3a2a10" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2a10" stopOpacity=".28" />
        </linearGradient>
      </defs>
    </g>
  );
}

export const Spine = memo(function Spine({ d }: { d: ShelfDialect }) {
  return (
    <svg viewBox="0 0 142 840" preserveAspectRatio="none" aria-hidden="true">
      <SpineArt d={d} />
    </svg>
  );
});

export const Cover = memo(function Cover({ d }: { d: ShelfDialect }) {
  return (
    <svg viewBox="0 0 474 900" preserveAspectRatio="none" aria-hidden="true">
      <CoverArt d={d} />
    </svg>
  );
});
