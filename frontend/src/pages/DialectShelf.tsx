import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { clock } from '../lib/format';
import type { Recording } from '../lib/types';
import { SCRIPT_FONTS, toShelf, ZONES, type ShelfDialect } from '../lib/dialectInfo';
import { safeSession } from '../lib/storage';
import { Cover, CoverArt, Spine } from '../components/TapeArt';
import './DialectShelf.css';

const SPINE_W = 142 / 840; // spine width ÷ tape height
const COVER_W = 474 / 900; // cover width ÷ tape height
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const SHEET_EASE = 'cubic-bezier(.76,0,.18,1)';
const INK_BLOBS = [
  { cx: 150, cy: 330, delay: 0 },
  { cx: 340, cy: 600, delay: 120 },
  { cx: 250, cy: 120, delay: 220 },
  { cx: 90, cy: 760, delay: 300 },
  { cx: 400, cy: 250, delay: 360 },
  { cx: 260, cy: 860, delay: 420 },
  { cx: 230, cy: 470, delay: 180 },
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const mod = (a: number, n: number) => ((a % n) + n) % n;
// How far a tape at relative index r is pushed aside by the open cover (0 at centre, ±0.5 past one step).
const bump = (r: number) => (Math.abs(r) < 1 ? (r + Math.sin(Math.PI * r) / Math.PI) / 2 : Math.sign(r) * 0.5);
const nativeStyle = (d: ShelfDialect) => {
  const f = SCRIPT_FONTS[d.nativeScript] ?? SCRIPT_FONTS.Latin;
  return `"${f.font}", "Inter Tight", system-ui, sans-serif`;
};

function Logo() {
  return (
    <>
      <span className="vs-logo-hi" lang="hi">स्वरवेद</span>
      <span className="vs-logo-en">SwaraVeda</span>
    </>
  );
}

const Tapes = memo(function Tapes({ list, copies }: { list: ShelfDialect[]; copies: number }) {
  return (
    <>
      {Array.from({ length: list.length * copies }, (_, v) => {
        const d = list[v % list.length];
        return (
          <div className="vs-tape" data-v={v} key={v}>
            <div className="vs-sp"><Spine d={d} /></div>
            <div className="vs-cv"><Cover d={d} /></div>
          </div>
        );
      })}
    </>
  );
});

export default function DialectShelfPage() {
  const { dialects } = useDialects();
  const list = useMemo(() => toShelf(dialects), [dialects]);
  if (!list.length) {
    return (
      <div className="vs">
        <header className="vs-top">
          <Link to="/" className="lbl box">Back{'\u00a0/\u00a0'}<span className="hi" lang="hi">वापस</span></Link>
          <span className="vs-logo"><Logo /></span>
          <span />
        </header>
        <p className="lbl" style={{ position: 'fixed', top: '50%', left: 0, right: 0, textAlign: 'center' }}>
          Bringing out the tapes…
        </p>
      </div>
    );
  }
  return <Shelf list={list} />;
}

function Shelf({ list }: { list: ShelfDialect[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const [detail, setDetail] = useState<ShelfDialect | null>(null);
  const [count, setCount] = useState<number | null>(null);
  // A few recordings of the open dialect, playable right on the sheet.
  const [clips, setClips] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAudio = useRef(() => {});
  stopAudio.current = () => {
    audio.current?.pause();
    setPlaying(null);
  };
  const toggle = (r: Recording) => {
    if (!r.audio_url) return;
    if (playing === r.id) return stopAudio.current();
    audio.current?.pause();
    const a = new Audio(r.audio_url);
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    audio.current = a;
    a.play().then(() => setPlaying(r.id), () => setPlaying(null));
  };
  const engine = useRef<{ open: () => void; close: () => void } | null>(null);

  const N = list.length;
  const copies = Math.max(1, Math.ceil(36 / N));
  const zones = ZONES.filter((z) => list.some((d) => d.zone === z.id));

  useEffect(() => {
    const el = root.current!;
    const $ = <T extends Element>(s: string) => el.querySelector(s) as T;
    const TOTAL = N * copies;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stage = $<HTMLElement>('.vs-stage');
    const probe = $<HTMLElement>('.vs-probe');
    const play = $<HTMLButtonElement>('.vs-play');
    const cursor = $<HTMLElement>('.vs-cur');
    const sheet = $<HTMLElement>('.vs-detail');
    const ind = $<HTMLElement>('.vs-ind');
    const masks = [$<HTMLElement>('.vs-cap-title'), $<HTMLElement>('.vs-cap-sub'), $<HTMLElement>('.vs-cap-year')];
    const tapes = Array.from(stage.querySelectorAll<HTMLElement>('.vs-tape'));
    const faces = tapes.map((t) => ({ sp: t.querySelector('.vs-sp') as HTMLElement, cv: t.querySelector('.vs-cv') as HTMLElement }));
    const blobs = Array.from(el.querySelectorAll<SVGCircleElement>('.vs-blob'));
    const hidden = new Array<boolean>(TOTAL).fill(false);
    const lift = new Array<number>(TOTAL).fill(0);
    // Last values written per tape, so a tape that hasn't moved costs nothing.
    const drawn = new Array<string>(TOTAL).fill('');

    // Start on the dialect last looked at, else the user's own, else the first.
    const last = safeSession.get('vs-last');
    const mine = user?.native_dialect?.toLowerCase();
    let startAt = list.findIndex((d) => d.id === last);
    if (startAt < 0 && mine) startAt = list.findIndex((d) => d.name.toLowerCase() === mine);
    if (startAt < 0) startAt = 0;

    let H = 0, ws = 0, d = 0, gap = 0, W = 0, VH = 0;
    let s = startAt + N * Math.floor(copies / 2);
    let T = s;
    let hover = -1;
    let active = -1;
    let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
    let hasPointer = false;
    let overButton = false;
    let tiltX = 0, tiltY = 0;
    let onCover = false;
    let isOpen = false;
    let dragging = false;
    let down: { x: number; T0: number } | null = null;
    let suppressClick = false;
    let wheelTimer = 0;
    let raf = 0;
    let inkRaf = 0;
    let lastT = performance.now();

    const measure = () => {
      H = probe.getBoundingClientRect().height;
      ws = H * SPINE_W;
      d = H * COVER_W;
      gap = H * 0.03;
      W = innerWidth;
      VH = innerHeight;
      stage.style.setProperty('--h', `${H}px`);
      stage.style.setProperty('--ws', `${ws}px`);
      stage.style.setProperty('--d', `${d}px`);
      drawn.fill('');
      play.style.left = `${W / 2 - 0.5 * d - 6}px`;
      play.style.top = `${VH / 2 + 0.36 * H}px`;
      placeIndicator();
    };
    // The open cover is tilted, so neighbours make a little extra room for its corners.
    const F = (r: number) => r * (ws + gap) + (d - ws + 3.6 * gap) * bump(r);
    const rel = (v: number) => {
      let r = mod(v - s, TOTAL);
      if (r >= TOTAL / 2) r -= TOTAL;
      return r;
    };

    function placeIndicator() {
      const zone = active >= 0 ? list[active].zone : null;
      el.querySelectorAll<HTMLElement>('.vs-tab').forEach((b) => b.classList.toggle('on', !!zone && b.dataset.zone === zone));
      const btn = zone ? el.querySelector<HTMLElement>(`.vs-tab[data-zone="${zone}"]`) : null;
      ind.style.width = btn ? `${btn.offsetWidth}px` : '0px';
      ind.style.transform = `translateX(${btn ? btn.offsetLeft : 0}px)`;
      if (btn) {
        const nav = btn.closest('.vs-tabs') as HTMLElement;
        if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: btn.offsetLeft - nav.clientWidth / 2 + btn.offsetWidth / 2, behavior: reduced ? 'auto' : 'smooth' });
      }
    }

    function fillLine(span: HTMLSpanElement, line: number, dd: ShelfDialect) {
      if (line === 0) span.textContent = dd.name;
      else if (line === 2) span.textContent = dd.place || dd.region || '';
      else {
        span.append(`${dd.script || 'Unwritten'} / `);
        const n = document.createElement('span');
        n.className = 'nat';
        n.style.fontFamily = nativeStyle(dd);
        n.textContent = dd.native;
        span.append(n);
      }
    }

    function swapCaption(idx: number, dir: number, instant: boolean) {
      const dd = list[idx];
      masks.forEach((mask, line) => {
        const span = document.createElement('span');
        fillLine(span, line, dd);
        if (instant || reduced) {
          mask.replaceChildren(span);
          return;
        }
        const olds = Array.from(mask.children).filter((c) => !(c as HTMLElement).dataset.leaving) as HTMLElement[];
        mask.appendChild(span);
        span.animate([{ transform: `translateY(${dir * 105}%)` }, { transform: 'translateY(0)' }], { duration: 650, easing: EASE, fill: 'both' });
        olds.forEach((o) => {
          o.dataset.leaving = '1';
          const from = getComputedStyle(o).transform;
          o.getAnimations().forEach((a) => a.cancel());
          const a = o.animate(
            [{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: `translateY(${-dir * 105}%)` }],
            { duration: 650, easing: EASE, fill: 'both' },
          );
          a.onfinish = () => o.remove();
        });
      });
    }

    const activeCover = () => faces[mod(Math.round(T), TOTAL)].cv;
    const insetOf = (r: DOMRect) =>
      `inset(${r.top}px ${W - r.right}px ${VH - r.bottom}px ${r.left}px round 3px)`;

    function openDetail() {
      if (isOpen) return;
      T = Math.round(T);
      const idx = mod(T, N);
      const dd = list[idx];
      safeSession.set('vs-last', dd.id);
      setDetail(dd);
      setCount(null);
      setClips(null);
      api.get('/recordings', { params: { dialect_id: dd.id, page_size: 4 } })
        .then((r) => {
          setCount(r.data.total ?? 0);
          setClips((r.data.items ?? []).filter((x: Recording) => x.audio_url));
        })
        .catch(() => { setCount(-1); setClips([]); });
      blobs.forEach((b) => b.setAttribute('r', '0'));
      const rect = activeCover().getBoundingClientRect();
      isOpen = true;
      sheet.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      sheet.style.visibility = 'visible';
      sheet.scrollTop = 0;
      sheet.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
      sheet.animate(
        [{ clipPath: insetOf(rect), transform: 'rotate(-4.5deg)' }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }],
        { duration: reduced ? 1 : 1050, easing: SHEET_EASE, fill: 'both' },
      );
      sheet.querySelectorAll<HTMLElement>('.vs-d-text .vs-mask > *').forEach((line, i) => {
        line.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], {
          duration: reduced ? 1 : 900, delay: reduced ? 0 : 620 + i * 75, easing: EASE, fill: 'both',
        });
      });
      const start = performance.now() + (reduced ? -5000 : 520);
      cancelAnimationFrame(inkRaf);
      const ink = (now: number) => {
        blobs.forEach((b, i) => {
          const p = Math.min(1, Math.max(0, (now - start - INK_BLOBS[i].delay) / 1250));
          b.setAttribute('r', String(720 * (1 - (1 - p) ** 3)));
        });
        if (now - start < 2400) inkRaf = requestAnimationFrame(ink);
      };
      inkRaf = requestAnimationFrame(ink);
      setTimeout(() => sheet.querySelector<HTMLElement>('.vs-close')?.focus({ preventScroll: true }), reduced ? 0 : 700);
    }

    function closeDetail() {
      if (!isOpen || sheet.dataset.closing) return;
      stopAudio.current();
      const rect = activeCover().getBoundingClientRect();
      sheet.dataset.closing = '1';
      sheet.style.transformOrigin = `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;
      sheet.getAnimations().forEach((a) => a.cancel());
      const a = sheet.animate(
        [{ clipPath: 'inset(0px 0px 0px 0px round 0px)', transform: 'rotate(0deg)' }, { clipPath: insetOf(rect), transform: 'rotate(-4.5deg)' }],
        { duration: reduced ? 1 : 850, easing: SHEET_EASE, fill: 'both' },
      );
      a.onfinish = () => {
        sheet.style.visibility = 'hidden';
        sheet.getAnimations({ subtree: true }).forEach((x) => x.cancel());
        delete sheet.dataset.closing;
        isOpen = false;
        play.focus({ preventScroll: true });
      };
    }
    engine.current = { open: openDetail, close: closeDetail };

    function frame(now: number) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const k = reduced ? 1e6 : dragging ? 18 : 5.2;
      s += (T - s) * (1 - Math.exp(-k * dt));
      if (Math.abs(T - s) < 1e-4) s = T;
      if (Math.abs(s) > 4 * TOTAL) {
        const shift = Math.trunc(s / TOTAL) * TOTAL;
        s -= shift;
        T -= shift;
      }

      const a = mod(Math.round(s), N);
      if (a !== active) {
        const first = active < 0;
        active = a;
        swapCaption(a, Math.sign(T - s) || 1, first);
        placeIndicator();
      }

      const settled = Math.abs(T - s) < 0.3;
      onCover = hasPointer && !isOpen && settled && Math.abs(mx - W / 2) < 0.55 * d && Math.abs(my - VH / 2) < 0.55 * H;
      const tyT = onCover ? ((mx - W / 2) / (0.55 * d)) * 9 : ((mx - W / 2) / W) * 5;
      const txT = onCover ? (-(my - VH / 2) / (H / 2)) * 6 : 0;
      const tk = 1 - Math.exp(-7 * dt);
      tiltY += (tyT - tiltY) * tk;
      tiltX += (txT - tiltX) * tk;
      const lk = reduced ? 1 : 1 - Math.exp(-12 * dt);

      for (let v = 0; v < TOTAL; v++) {
        const t = tapes[v];
        const r = rel(v);
        const x = F(r);
        if (Math.abs(x) > W / 2 + 1.5 * d) {
          if (!hidden[v]) {
            t.style.visibility = 'hidden';
            hidden[v] = true;
          }
          continue;
        }
        if (hidden[v]) {
          t.style.visibility = '';
          hidden[v] = false;
          drawn[v] = '';
        }
        lift[v] += ((hover === v && Math.abs(r) > 0.5 && !isOpen ? 1 : 0) - lift[v]) * lk;
        const o = smooth(Math.max(0, 1 - Math.abs(r)));
        const y = -o * 0.025 * H - lift[v] * 0.045 * H;
        const tf =
          `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${(o * 0.2 * H).toFixed(1)}px) ` +
          `rotateZ(${(-4.5 * o).toFixed(2)}deg) rotateX(${(tiltX * o).toFixed(2)}deg) rotateY(${(-90 * o + tiltY * o).toFixed(2)}deg)`;
        if (tf === drawn[v]) continue;
        drawn[v] = tf;
        t.style.transform = tf;
        t.style.zIndex = String(Math.round(100 - Math.abs(r) * 4));
        faces[v].sp.style.setProperty('--shade', (o * 0.55).toFixed(2));
        faces[v].cv.style.setProperty('--shade', ((1 - o) * 0.5).toFixed(2));
        // A closed tape shows only its spine: its side would just be a sliver of squashed cover art.
        faces[v].cv.style.visibility = o > 0.02 ? '' : 'hidden';
        faces[v].sp.style.visibility = o < 0.98 ? '' : 'hidden';
      }

      const ps = isOpen ? 0 : smooth(Math.max(0, 1 - Math.abs(T - s) * 3));
      play.style.transform = `translate(-50%,-50%) scale(${ps.toFixed(3)})`;
      play.style.pointerEvents = ps > 0.5 ? '' : 'none';

      const ck = 1 - Math.exp(-16 * dt);
      cx += (mx - cx) * ck;
      cy += (my - cy) * ck;
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      const onSpine = !isOpen && hover >= 0 && Math.abs(rel(hover)) > 0.5;
      const state = onCover ? 'open' : onSpine ? 'spine' : overButton ? 'btn' : '';
      if (cursor.dataset.state !== state) {
        cursor.dataset.state = state;
        cursor.className = `vs-cur ${state}`;
      }
      raf = requestAnimationFrame(frame);
    }

    // Input
    const go = (to: number) => {
      if (!isOpen) T = to;
    };
    const jumpTo = (idx: number) => {
      const base = Math.round(T);
      let diff = mod(idx - mod(base, N), N);
      if (diff > N / 2) diff -= N;
      go(base + diff);
    };

    const onTapeClick = (e: MouseEvent) => {
      if (suppressClick || isOpen) return;
      // Browsers don't hit-test the turned-out cover reliably, so test it by position first.
      const c = activeCover().getBoundingClientRect();
      if (Math.abs(T - s) < 0.3 && e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom) {
        openDetail();
        return;
      }
      const t = (e.target as Element).closest<HTMLElement>('.vs-tape');
      if (!t) return;
      const r = rel(Number(t.dataset.v));
      if (Math.abs(r) < 0.5) openDetail();
      else go(Math.round(T + r));
    };
    const enters = tapes.map((t, v) => {
      const enter = () => { hover = v; };
      const leave = () => { if (hover === v) hover = -1; };
      t.addEventListener('pointerenter', enter);
      t.addEventListener('pointerleave', leave);
      return () => {
        t.removeEventListener('pointerenter', enter);
        t.removeEventListener('pointerleave', leave);
      };
    });
    const shelf = $<HTMLElement>('.vs-shelf');
    const onDown = (e: PointerEvent) => {
      if (isOpen || e.button !== 0) return;
      down = { x: e.clientX, T0: T };
      dragging = false;
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!hasPointer && e.pointerType === 'mouse') {
        hasPointer = true;
        cx = mx;
        cy = my;
        cursor.style.visibility = 'visible';
      }
      if (down) {
        const dx = e.clientX - down.x;
        if (!dragging && Math.abs(dx) > 5) dragging = true;
        if (dragging) T = down.T0 - dx / (ws + gap);
      }
    };
    const onUp = () => {
      if (dragging) {
        T = Math.round(T);
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      }
      dragging = false;
      down = null;
    };
    const onOver = (e: PointerEvent) => {
      const t = e.target as Element;
      overButton = !!t.closest?.('button, a') && !t.closest('.vs-shelf');
    };
    const onLeaveWindow = () => {
      hasPointer = false;
      hover = -1;
      cursor.style.visibility = 'hidden';
    };
    const onWheel = (e: WheelEvent) => {
      if (isOpen) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      T += (delta / (ws + gap)) * 0.5;
      clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { T = Math.round(T); }, 160);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) closeDetail();
      if (isOpen) return;
      if (e.key === 'ArrowLeft') go(Math.round(T) - 1);
      else if (e.key === 'ArrowRight') go(Math.round(T) + 1);
      else if (e.key === 'Enter' && (document.activeElement === document.body || document.activeElement === el)) openDetail();
    };
    const onPrev = () => go(Math.round(T) - 1);
    const onNext = () => go(Math.round(T) + 1);
    const onTab = (e: MouseEvent) => {
      const zone = (e.currentTarget as HTMLElement).dataset.zone;
      jumpTo(zone === 'all' ? 0 : Math.max(0, list.findIndex((dd) => dd.zone === zone)));
    };

    shelf.addEventListener('click', onTapeClick);
    shelf.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerover', onOver);
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', measure);
    play.addEventListener('click', openDetail);
    $<HTMLElement>('.vs-prev').addEventListener('click', onPrev);
    $<HTMLElement>('.vs-next').addEventListener('click', onNext);
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('.vs-tab'));
    tabs.forEach((b) => b.addEventListener('click', onTab));

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    measure();
    document.fonts?.ready.then(placeIndicator);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(inkRaf);
      clearTimeout(wheelTimer);
      enters.forEach((off) => off());
      shelf.removeEventListener('click', onTapeClick);
      shelf.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerover', onOver);
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', measure);
      play.removeEventListener('click', openDetail);
      tabs.forEach((b) => b.removeEventListener('click', onTab));
      document.body.style.overflow = prevOverflow;
      engine.current = null;
    };
  }, [list, N, copies, user?.native_dialect]);

  const zoneLabel = (z: ShelfDialect['zone']) => ZONES.find((x) => x.id === z)?.label ?? 'India';
  const recordings = count === null ? '…' : count < 0 ? '—' : String(count);

  return (
    <div className="vs" ref={root} tabIndex={-1}>
      <div className="vs-probe" aria-hidden="true" />
      <header className="vs-top">
        <Link to="/" className="lbl box">Back{'\u00a0/\u00a0'}<span className="hi" lang="hi">वापस</span></Link>
        <Link to="/" className="vs-logo" aria-label="SwaraVeda home"><Logo /></Link>
        <div className="vs-top-r">
          <span className="lbl vs-count">{N} dialects · {zones.length} regions</span>
          <Link to="/dialects/list" className="lbl box">List{'\u00a0/\u00a0'}<span className="hi" lang="hi">सूची</span></Link>
        </div>
      </header>

      <nav className="vs-tabs" aria-label="Regions">
        <div className="vs-tabs-in">
          <span className="vs-ind" aria-hidden="true" />
          <button type="button" className="lbl box vs-tab" data-zone="all">All{'\u00a0/\u00a0'}<span className="hi" lang="hi">सभी</span></button>
          {zones.map((z) => (
            <button type="button" key={z.id} className="lbl box vs-tab" data-zone={z.id}>{z.label}</button>
          ))}
        </div>
      </nav>

      <section className="vs-shelf" aria-label="Dialect shelf">
        <div className="vs-stage">
          <Tapes list={list} copies={copies} />
        </div>
      </section>

      <button type="button" className="vs-play" aria-label="Open dialect">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor" /></svg>
      </button>

      <div className="vs-cap" aria-live="polite">
        <div className="vs-mask vs-cap-title" />
        <div className="vs-mask lbl vs-cap-sub" />
        <div className="vs-mask vs-cap-year" />
      </div>

      <button type="button" className="vs-arrow vs-prev" aria-label="Previous dialect">
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M5 1 L1 5 L5 9 M1 5 H17" /></svg>
      </button>
      <button type="button" className="vs-arrow vs-next" aria-label="Next dialect">
        <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M13 1 L17 5 L13 9 M17 5 H1" /></svg>
      </button>

      <footer className="vs-foot">
        <span className="lbl">© SwaraVeda<span className="vs-wide">. Voices shared with consent.</span></span>
        <span className="lbl">
          <span className="vs-keys">← → to browse · Enter to open</span>
          <span className="vs-touch">Swipe to browse · tap to open</span>
        </span>
      </footer>

      <div className="vs-grain" aria-hidden="true" />

      <div className="vs-detail" role="dialog" aria-modal="true" aria-labelledby="vs-d-title">
        <button type="button" className="lbl box vs-close" onClick={() => engine.current?.close()}>
          Close{'\u00a0/\u00a0'}<span className="hi" lang="hi">बंद करें</span>
        </button>
        <div className="vs-d-logo"><span className="vs-logo"><Logo /></span></div>
        <div className="vs-d-text">
          <div className="vs-mask">
            <p className="lbl vs-d-sub">
              {detail?.script || 'Unwritten'} / <span className="nat" style={{ fontFamily: detail ? nativeStyle(detail) : undefined }}>{detail?.native}</span>
            </p>
          </div>
          <div className="vs-mask"><h2 id="vs-d-title" className="vs-d-title">{detail?.name}</h2></div>
          <div className="vs-mask">
            <p className="lbl vs-d-meta">
              {detail?.iso_code ? `ISO ${detail.iso_code}` : 'No ISO code'} / {zoneLabel(detail?.zone ?? null)} / {recordings} {count === 1 ? 'recording' : 'recordings'}
            </p>
          </div>
          <div className="vs-mask"><p className="vs-d-syn">{detail?.description || 'No description yet. Add one from the list view.'}</p></div>
          <div className="vs-mask">
            <p className="vs-d-credit">
              {detail?.region ? `Spoken in ${detail.region}. ` : ''}
              {detail?.asrName ? `Vani listens for it as ${detail.asrName}.` : 'Vani works out the language as it listens.'}
            </p>
          </div>
          <div className="vs-mask vs-d-btns">
            <button type="button" className="lbl box vs-watch" onClick={() => detail && navigate(`/recordings/new?dialect=${detail.id}`)}>
              Record in {detail?.name}{'\u00a0/\u00a0'}<span className="hi" lang="hi">रिकॉर्ड करें</span>
            </button>
            <button type="button" className="lbl box" onClick={() => {
              if (clips && clips.length) toggle(clips[0]);
              else if (detail) navigate(`/recordings?dialect=${detail.id}`);
            }}>
              {playing ? 'Stop' : 'Listen'}{'\u00a0/\u00a0'}<span className="hi" lang="hi">{playing ? 'रोकें' : 'सुनें'}</span>
            </button>
          </div>
          <div className="vs-mask">
            <div className="vs-voices">
              <p className="lbl vs-d-meta">Voices in {detail?.name}</p>
              {clips === null ? (
                <p className="vs-voice-empty">Finding recordings…</p>
              ) : clips.length === 0 ? (
                <p className="vs-voice-empty">No one has recorded {detail?.name} yet. Be the first voice on this tape.</p>
              ) : (
                <ul>
                  {clips.map((r) => (
                    <li key={r.id}>
                      <button type="button" className="vs-voice" aria-pressed={playing === r.id} onClick={() => toggle(r)}>
                        <span className="vs-voice-icon" aria-hidden="true">{playing === r.id ? '❚❚' : '▶'}</span>
                        <span className="vs-voice-title">{r.title}</span>
                        <span className="lbl vs-voice-meta">
                          {[r.speaker_name, r.duration_seconds ? clock(r.duration_seconds * 1000) : null].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
                  {count !== null && count > clips.length && (
                    <li>
                      <button type="button" className="lbl vs-voice-more" onClick={() => detail && navigate(`/recordings?dialect=${detail.id}`)}>
                        All {count} recordings →
                      </button>
                    </li>
                  )}
                </ul>
              )}
              {detail && (
                <p className="vs-elsewhere">
                  <span className="lbl">Hear it elsewhere:</span>{' '}
                  {[
                    ['Folk songs on YouTube', `https://www.youtube.com/results?search_query=${encodeURIComponent(`${detail.name} folk song`)}`],
                    ['Wikimedia Commons', `https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=audio&search=${encodeURIComponent(`${detail.name} language`)}`],
                    ['Internet Archive', `https://archive.org/search?query=${encodeURIComponent(detail.name)}&and%5B%5D=mediatype%3A%22audio%22`],
                  ].map(([label, href], i) => (
                    <span key={label}>{i > 0 && ' · '}<a href={href} target="_blank" rel="noreferrer">{label} ↗</a></span>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="vs-d-poster">
          <svg viewBox="0 0 474 900" aria-hidden="true">
            <defs>
              <filter id="vs-ink" x="-50%" y="-50%" width="200%" height="200%">
                <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves={3} seed={7} />
                <feDisplacementMap in="SourceGraphic" scale={120} xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <mask id="vs-inkmask" maskUnits="userSpaceOnUse" x={-200} y={-200} width={874} height={1300}>
                <g filter="url(#vs-ink)">
                  {INK_BLOBS.map((b, i) => <circle key={i} className="vs-blob" cx={b.cx} cy={b.cy} r={0} fill="#fff" />)}
                </g>
              </mask>
            </defs>
            <g mask="url(#vs-inkmask)">{detail && <CoverArt d={detail} />}</g>
          </svg>
        </div>
      </div>

      <div className="vs-cur" aria-hidden="true">
        <span className="vs-ring" />
        <span className="vs-dot" />
        <span className="vs-clab">OPEN<span className="hi" lang="hi">खोलें</span></span>
      </div>
    </div>
  );
}
