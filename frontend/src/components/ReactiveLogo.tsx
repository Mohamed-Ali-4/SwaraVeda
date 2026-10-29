import { useLayoutEffect, useRef, useState } from 'react';
import { SWARA } from '../lib/swara';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

/**
 * The स्वरवेद mark with "Swara" moving through India's scripts: the old script
 * dissolves upward, the new one settles into place, the slot
 * eases to the new width, and only that word takes the script's ink. "वेद"
 * and the SWARAVEDA line underneath never change.
 */
export default function ReactiveLogo({ i, size, onPick }: { i: number; size?: number; onPick?: (n: number) => void }) {
  const slot = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const shown = useRef(i);
  const [widths, setWidths] = useState<number[]>([]);

  useLayoutEffect(() => {
    const read = () => {
      // In em, so the slot stays right when CSS changes the logo's size.
      const box = measure.current;
      if (!box) return;
      const em = parseFloat(getComputedStyle(box).fontSize) || 1;
      setWidths(Array.from(box.children, (c) => (c as HTMLElement).getBoundingClientRect().width / em));
    };
    read();
    document.fonts?.ready.then(read);
    document.fonts?.addEventListener?.('loadingdone', read);
    return () => document.fonts?.removeEventListener?.('loadingdone', read);
  }, [size]);

  // Roll the old word out and the new one in, through the slot's mask.
  useLayoutEffect(() => {
    const el = slot.current;
    if (!el || shown.current === i) return;
    shown.current = i;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = SWARA[i];
    const word = document.createElement('span');
    word.className = 'rl-word';
    word.lang = s.lang;
    word.textContent = s.text;
    word.style.fontFamily = `"${s.font}", "Noto Serif Devanagari", Georgia, serif`;
    word.style.color = s.ink;
    const old = Array.from(el.children).filter((c) => !(c as HTMLElement).dataset.leaving) as HTMLElement[];
    el.appendChild(word);
    if (still) {
      old.forEach((o) => o.remove());
      return;
    }
    // A quick cross-fade: the old script lifts away and dissolves before the new one settles,
    // so the two never sit on top of each other at full strength.
    word.animate(
      [
        { opacity: 0, transform: 'translateY(.22em) scale(.97)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration: 560, delay: 150, easing: EASE, fill: 'both' },
    );
    old.forEach((o) => {
      o.dataset.leaving = '1';
      o.animate(
        [
          { opacity: 1, transform: 'none', filter: 'blur(0)' },
          { opacity: 0, transform: 'translateY(-.18em) scale(1.02)', filter: 'blur(6px)' },
        ],
        { duration: 300, easing: 'cubic-bezier(.4,0,1,1)', fill: 'both' },
      ).onfinish = () => o.remove();
    });
  }, [i]);

  const first = SWARA[shown.current];
  return (
    <div className="rl" style={size ? { fontSize: size } : undefined}>
      <button
        type="button"
        className="rl-mark"
        aria-label={`SwaraVeda. Showing Swara in ${SWARA[i].name}; click for the next script`}
        onClick={() => onPick?.((i + 1) % SWARA.length)}
      >
        <span className="rl-slot-wrap">
          <span ref={slot} className="rl-slot" style={{ width: widths[i] ? `${widths[i] + 0.03}em` : undefined }} aria-hidden="true">
            <span className="rl-word" lang={first.lang} style={{ fontFamily: `"${first.font}", Georgia, serif`, color: first.ink }}>{first.text}</span>
          </span>
          <span key={i} className="rl-rule" style={{ background: SWARA[i].ink }} aria-hidden="true" />
        </span>
        <span className="rl-veda" lang="hi" aria-hidden="true">वेद</span>
      </button>
      <span className="rl-sub" aria-hidden="true">SwaraVeda</span>
      <span ref={measure} className="rl-measure" aria-hidden="true">
        {SWARA.map((s) => <span key={s.lang} style={{ fontFamily: `"${s.font}", Georgia, serif` }}>{s.text}</span>)}
      </span>
    </div>
  );
}
