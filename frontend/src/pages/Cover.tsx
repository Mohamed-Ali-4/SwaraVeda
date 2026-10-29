import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { SWARA, useSwaraCycle } from '../lib/swara';
import ReactiveLogo from '../components/ReactiveLogo';
import VoiceField from '../components/VoiceField';
import './Cover.css';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function Password(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="cv-pass">
      <input {...props} type={show ? 'text' : 'password'} className="cv-input" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <HiOutlineEyeOff /> : <HiOutlineEye />}
      </button>
    </span>
  );
}

let gsiScript: Promise<void> | null = null;
const loadGsi = () =>
  (gsiScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiScript = null; reject(); };
    document.head.appendChild(s);
  }));

const GOOGLE_G = (
  <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const callback = useRef(onCredential);
  useEffect(() => { callback.current = onCredential; });

  useEffect(() => {
    api.get('/auth/config').then((r) => setClientId(r.data.google_client_id || null)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !box.current) return;
    loadGsi().then(() => {
      if (!window.google || !box.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential) });
      window.google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'rectangular', text: 'continue_with', logo_alignment: 'center',
        width: Math.min(400, box.current.offsetWidth),
      });
    }).catch(() => setClientId(null));
  }, [clientId]);

  if (clientId) return <div ref={box} className="cv-google-slot" />;
  return (
    <button
      type="button"
      className="cv-google"
      onClick={() => toast.error('Google sign-in isn’t switched on yet. The admin needs to add a Google client ID on the server.')}
    >
      {GOOGLE_G} Continue with Google
    </button>
  );
}

// Spines vary a little, as real books do; the ones not on show keep quiet cloth colours.
const SPINE_W = [54, 44, 60, 48, 56, 46, 58, 44, 52, 48];
const SPINE_H = [232, 214, 246, 224, 238, 218, 242, 212, 230, 222];
const CLOTH = ['#1B1B1B', '#D9D0BA', '#2E2C29', '#E4DCC8', '#232220', '#CFC4A6', '#2B2926', '#DDD4BE', '#1B1B1B', '#D3C9AE'];
const lightCloth = (n: number) => n % 2 === 1;

/** A shelf of bound dialects, one per script; the one on show lifts out in its ink. */
function Bookshelf({ i, onPick }: { i: number; onPick: (n: number) => void }) {
  const shelf = useRef<HTMLDivElement>(null);
  const lean = (e: ReactPointerEvent) => {
    const wrap = shelf.current?.parentElement;
    if (e.pointerType !== 'mouse' || !shelf.current || !wrap) return;
    const r = shelf.current.getBoundingClientRect();
    wrap.style.setProperty('--px', `${((e.clientX - r.left) / r.width).toFixed(3)}`);
  };
  // On narrow screens the shelf scrolls: keep the book on show in view.
  useEffect(() => {
    const row = shelf.current;
    const book = row?.children[i] as HTMLElement | undefined;
    if (!row || !book || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: book.offsetLeft - (row.clientWidth - book.offsetWidth) / 2, behavior: 'smooth' });
  }, [i]);
  const s = SWARA[i];
  return (
    <figure className="cv-shelf-wrap">
      <div ref={shelf} className="cv-shelf" onPointerMove={lean} onPointerLeave={() => shelf.current?.parentElement?.style.removeProperty('--px')}>
        {SWARA.map((x, n) => (
          <button
            key={x.lang}
            type="button"
            className={`cv-book${n === i ? ' on' : ''}${lightCloth(n) ? ' light' : ''}`}
            style={{
              ['--w' as string]: `${SPINE_W[n]}px`,
              ['--h' as string]: `${SPINE_H[n]}px`,
              ['--cloth' as string]: CLOTH[n],
              ['--ink' as string]: x.ink,
            }}
            aria-label={`${x.dialect}, in ${x.name === 'English' ? 'Latin' : x.name} script`}
            aria-pressed={n === i}
            onClick={() => onPick(n)}
          >
            <span className="cv-book-band" />
            <span className="cv-book-title">{x.dialect}</span>
            <span className="cv-book-native" lang={x.lang} style={{ fontFamily: `"${x.font}", Georgia, serif` }}>{x.native}</span>
            <span className="cv-book-foot">स्व</span>
          </button>
        ))}
        <span className="cv-bookend" aria-hidden="true" />
      </div>
      <div className="cv-plank" aria-hidden="true" />
      <figcaption className="cv-shelf-cap">
        <span className="lbl">No. {String(i + 1).padStart(2, '0')} / {SWARA.length}</span>
        <span className="cv-cap-name">
          {s.dialect}
          <span className="cv-cap-native" lang={s.lang} style={{ color: s.ink, fontFamily: `"${s.font}", Georgia, serif` }}>{s.native}</span>
        </span>
        <span className="lbl cv-cap-script">{s.name === 'English' ? 'Latin' : s.name} script</span>
      </figcaption>
    </figure>
  );
}

export default function Cover() {
  const { login, register, loginWithGoogle } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>(location.pathname === '/register' ? 'signup' : 'signin');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', ident: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [i, setI] = useSwaraCycle();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn: () => Promise<unknown>, welcome: string) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      toast.success(welcome);
    } catch (err) {
      setError(errorMessage(err, mode === 'signup' ? 'Could not create your account' : 'Sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      run(() => login(form.ident.trim(), form.password), 'Welcome back!');
    } else {
      if (form.password.length < 8) return setError('Choose a password with at least 8 characters.');
      run(() => register({
        display_name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password: form.password,
      }), `Welcome to SwaraVeda, ${form.name.trim().split(' ')[0]}!`);
    }
  };

  const switchMode = (m: 'signin' | 'signup') => { setMode(m); setError(''); };
  const s = SWARA[i];

  return (
    <div className="cv">
      <VoiceField color={s.ink} />
      <div className="paper-grain" aria-hidden="true" />

      <header className="cv-top">
        <span className="lbl">Vol. I · A community archive</span>
        <span className="lbl cv-top-mid">140 endangered dialects of India</span>
        <span className="lbl cv-top-r"><span lang="hi">भारत की बोलियाँ</span></span>
      </header>

      <main className="cv-main">
        <section className="cv-intro">
          <ReactiveLogo i={i} onPick={setI} />
          <p className="cv-lang lbl">
            <span className="cv-lang-dot" style={{ background: s.ink }} />
            Swara, in <span className="cv-lang-name" style={{ color: s.ink }}>{s.name}</span>
          </p>
          <h1 className="cv-tagline"><em>Vani</em> — preserving voices, empowering generations.</h1>
          <p className="cv-lede">
            India speaks in thousands of dialects, many of them never written down. Record the songs, stories and everyday
            talk of yours; Vani drafts the words, and the people who speak them make them right.
          </p>
          <Bookshelf i={i} onPick={setI} />
        </section>

        <section className="cv-sheet" aria-label={mode === 'signin' ? 'Sign in' : 'Create an account'}>
          <span className="cv-sheet-corner" aria-hidden="true" />
          <div className="cv-tabs" role="tablist">
            <span className="cv-tab-ind" style={{ transform: `translateX(${mode === 'signin' ? 0 : 100}%)` }} aria-hidden="true" />
            {(['signin', 'signup'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} className={`cv-tab${mode === m ? ' on' : ''}`} onClick={() => switchMode(m)}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="cv-sheet-body" key={mode}>
            <span className="lbl">{mode === 'signin' ? 'Readers’ entrance · प्रवेश' : 'New member · जुड़ें'}</span>
            <h2 className="cv-h">{mode === 'signin' ? <>Welcome <em>back</em>.</> : <>Join the <em>archive</em>.</>}</h2>
            <p className="cv-sub">{mode === 'signin' ? 'Sign in to keep a language alive.' : 'Free for everyone who wants to keep a language alive.'}</p>

            <GoogleButton onCredential={(c) => run(() => loginWithGoogle(c), 'Signed in with Google.')} />
            <div className="cv-or"><span />or with your details<span /></div>

            <form onSubmit={submit} className="cv-form">
              {error && <p role="alert" className="cv-error">{error}</p>}
              {mode === 'signup' ? (
                <>
                  <label className="cv-field"><span className="lbl">Full name</span>
                    <input id="cv-name" required autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} className="cv-input" placeholder="Kamala Shetty" /></label>
                  <label className="cv-field"><span className="lbl">Email</span>
                    <input id="cv-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className="cv-input" placeholder="you@example.com" /></label>
                  <label className="cv-field"><span className="lbl">Mobile number</span>
                    <span className="cv-phone"><span className="cv-cc">+91</span>
                      <input id="cv-phone" type="tel" inputMode="tel" required autoComplete="tel-national" value={form.phone} onChange={set('phone')}
                        className="cv-input" placeholder="98765 43210" pattern="[0-9+\s\-]{10,16}" title="A 10-digit mobile number" /></span></label>
                  <label className="cv-field"><span className="lbl">Password</span>
                    <Password id="cv-pass" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" /></label>
                </>
              ) : (
                <>
                  <label className="cv-field"><span className="lbl">Email or mobile number</span>
                    <input id="cv-ident" required autoComplete="username" value={form.ident} onChange={set('ident')} className="cv-input" placeholder="you@example.com" /></label>
                  <label className="cv-field"><span className="lbl">Password</span>
                    <Password id="cv-signin-pass" required autoComplete="current-password" value={form.password} onChange={set('password')} placeholder="Your password" /></label>
                </>
              )}
              <button type="submit" disabled={busy} className="cv-submit">
                <span>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</span>
                <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M17 1 L21 5 L17 9 M21 5 H1" /></svg>
              </button>
            </form>

            <p className="cv-switch">
              {mode === 'signin' ? 'New to SwaraVeda? ' : 'Already a member? '}
              <button type="button" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </div>
          <p className="cv-fine">Every recording is kept and shared only with the speaker’s consent.</p>
        </section>
      </main>

      <footer className="cv-bottom">
        <span className="lbl">© SwaraVeda</span>
        <span className="lbl">Record · Transcribe · Preserve</span>
      </footer>
    </div>
  );
}
