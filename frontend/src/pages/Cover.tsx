import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { HiOutlineEye, HiOutlineEyeOff, HiOutlineMicrophone, HiOutlineSparkles, HiOutlineShieldCheck } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import BrandLogo from '../components/BrandLogo';
import VoiceField from '../components/VoiceField';

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

const field =
  'w-full rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/35 ' +
  'transition focus:border-[#FFB224] focus:bg-white/[0.07] focus:outline-none focus:ring-4 focus:ring-[#FFB224]/20';
const labelCls = 'mb-1.5 block text-sm font-medium text-white/75';

function Password(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${field} pr-12`} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-white/45 hover:text-white">
        {show ? <HiOutlineEyeOff className="h-5 w-5" /> : <HiOutlineEye className="h-5 w-5" />}
      </button>
    </div>
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

function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const toast = useToast();
  const box = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const callback = useRef(onCredential);
  callback.current = onCredential;

  useEffect(() => {
    api.get('/auth/config').then((r) => setClientId(r.data.google_client_id)).catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !box.current) return;
    loadGsi().then(() => {
      if (!window.google || !box.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => callback.current(r.credential) });
      window.google.accounts.id.renderButton(box.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with',
        width: Math.min(400, box.current.offsetWidth),
      });
    }).catch(() => setClientId(null));
  }, [clientId]);

  if (clientId) return <div ref={box} className="flex h-11 w-full justify-center" />;
  return (
    <button
      type="button"
      onClick={() => toast.error('Google sign-in isn’t switched on yet. The admin needs to add a Google client ID on the server.')}
      className="flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-white/[0.1]"
    >
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
      </svg>
      Continue with Google
    </button>
  );
}

// Dialect names in their own scripts, drifting behind the page at different depths.
const FLOATING: { text: string; font: string; x: number; y: number; size: number; depth: number }[] = [
  { text: 'ತುಳು', font: 'Noto Sans Kannada', x: 6, y: 14, size: 54, depth: 26 },
  { text: 'ᱥᱟᱱᱛᱟᱲᱤ', font: 'Noto Sans Ol Chiki', x: 72, y: 8, size: 40, depth: 14 },
  { text: 'भोजपुरी', font: 'Noto Sans Devanagari', x: 40, y: 88, size: 46, depth: 20 },
  { text: 'ꯃꯩꯇꯩꯂꯣꯟ', font: 'Noto Sans Meetei Mayek', x: 84, y: 70, size: 38, depth: 30 },
  { text: 'தோடா', font: 'Noto Sans Tamil', x: 14, y: 72, size: 42, depth: 12 },
  { text: 'ଜୁଆଙ୍ଗ', font: 'Noto Sans Oriya', x: 58, y: 30, size: 34, depth: 34 },
  { text: 'കോട്ട', font: 'Noto Sans Malayalam', x: 30, y: 4, size: 32, depth: 18 },
  { text: 'కోయ', font: 'Noto Sans Telugu', x: 92, y: 40, size: 44, depth: 22 },
  { text: 'કચ્છી', font: 'Noto Sans Gujarati', x: 2, y: 44, size: 36, depth: 16 },
  { text: 'টোটো', font: 'Noto Sans Bengali', x: 66, y: 94, size: 34, depth: 28 },
  { text: 'ལ་དྭགས', font: 'Noto Serif Tibetan', x: 48, y: 58, size: 30, depth: 10 },
];

export default function Cover() {
  const { login, register, loginWithGoogle } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>(location.pathname === '/register' ? 'signup' : 'signin');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', ident: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn: () => Promise<void>, welcome: string) => {
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

  // The colour of the script the logo is showing; the background wave and the card's light follow it.
  const [accent, setAccent] = useState('#FFB224');
  const page = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Background words drift against the pointer; nearer ones move more.
  const onPageMove = (e: ReactPointerEvent) => {
    if (still || e.pointerType !== 'mouse' || !page.current) return;
    page.current.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    page.current.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  };
  // The card leans a little toward the pointer, with a soft light where it is.
  const onCardMove = (e: ReactPointerEvent) => {
    const el = card.current;
    if (still || e.pointerType !== 'mouse' || !el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${((x - 0.5) * 6).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - y) * 5).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
  };
  const onCardLeave = () => {
    card.current?.style.setProperty('--rx', '0deg');
    card.current?.style.setProperty('--ry', '0deg');
  };

  return (
    <div ref={page} onPointerMove={onPageMove} className="cv-page relative min-h-screen overflow-hidden bg-[#0B0B0D] text-white" style={{ fontFamily: 'Nunito, system-ui, sans-serif' }}>
      <style>{`
        .cv-page { --px: 0; --py: 0; }
        @keyframes cv-float { 0%, 100% { translate: 0 0 } 50% { translate: 0 -14px } }
        .cv-word { transform: translate(calc(var(--px) * var(--d) * -1px), calc(var(--py) * var(--d) * -1px)); transition: transform 1.2s cubic-bezier(.2,.8,.2,1); animation: cv-float var(--t) ease-in-out infinite; }
        .cv-card { --rx: 0deg; --ry: 0deg; --gx: 50%; --gy: 0%; transform: perspective(1200px) rotateX(var(--rx)) rotateY(var(--ry)); transition: transform .5s cubic-bezier(.2,.8,.2,1); }
        .cv-card::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
          background: radial-gradient(420px circle at var(--gx) var(--gy), color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%); transition: background .3s; }
        @keyframes cv-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
        .cv-rise { animation: cv-rise .8s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .cv-word, .cv-rise { animation: none } .cv-card { transform: none } }
      `}</style>
      <VoiceField color={accent} />
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full blur-[120px] transition-colors duration-700" style={{ background: `${accent}2e` }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -right-32 h-[36rem] w-[36rem] rounded-full bg-[#2EE6C5]/10 blur-[130px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
        {FLOATING.map((f, n) => (
          <span key={n} className="cv-word absolute whitespace-nowrap text-white/[0.07]"
            style={{ left: `${f.x}%`, top: `${f.y}%`, fontSize: f.size, fontFamily: `"${f.font}", sans-serif`, fontWeight: 600,
              ['--d' as string]: f.depth, ['--t' as string]: `${7 + (n % 5) * 1.6}s`, animationDelay: `${-n * 0.9}s` }}>
            {f.text}
          </span>
        ))}
      </div>

      <main className="relative mx-auto grid min-h-screen max-w-6xl content-center gap-10 px-5 py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-x-16 lg:gap-y-8">
        <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 lg:self-end">
          <BrandLogo onAccent={setAccent} />
        </div>
        <section className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 lg:self-start">
          <p className="mx-auto max-w-xl text-center text-[17px] leading-relaxed text-white/70 lg:text-left">
            India speaks in hundreds of languages and thousands of dialects, many of them only ever spoken.
            SwaraVeda is a community archive where you record, transcribe and tag the stories, songs and
            conversations of your dialect, so they’re never lost.
          </p>
          <ul className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { icon: HiOutlineMicrophone, t: 'Record', d: 'Songs, stories, everyday talk' },
              { icon: HiOutlineSparkles, t: 'Vani transcribes', d: 'AI drafts it; speakers fix it' },
              { icon: HiOutlineShieldCheck, t: 'Preserve', d: 'Searchable for generations' },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="cv-rise rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition duration-500 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.06]" style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
                <Icon className="h-6 w-6 text-[#FFB224]" />
                <p className="mt-2 font-bold">{t}</p>
                <p className="text-sm text-white/55">{d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section ref={card} onPointerMove={onCardMove} onPointerLeave={onCardLeave} style={{ ['--accent' as string]: accent }}
          className="cv-card cv-rise relative order-2 lg:order-none mx-auto w-full max-w-md rounded-3xl lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center border border-white/10 bg-white/[0.05] p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl sm:p-9">
          <div className="mb-7 grid grid-cols-2 rounded-full bg-white/[0.06] p-1" role="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                className={`rounded-full py-2.5 text-sm font-bold transition ${
                  mode === m ? 'bg-white text-[#0B0B0D] shadow-lg' : 'text-white/60 hover:text-white'
                }`}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold" style={{ fontFamily: 'inherit' }}>{mode === 'signin' ? 'Welcome back' : 'Join the archive'}</h2>
          <p className="mt-1 text-white/55">{mode === 'signin' ? 'Sign in to keep a language alive.' : 'Free for everyone who wants to keep a language alive.'}</p>

          <div className="mt-6">
            <GoogleButton onCredential={(c) => run(() => loginWithGoogle(c), 'Signed in with Google.')} />
          </div>
          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-white/35">
            <span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error && <p role="alert" className="rounded-[12px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            {mode === 'signup' ? (
              <>
                <div>
                  <label htmlFor="cv-name" className={labelCls}>Full name</label>
                  <input id="cv-name" required autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} className={field} placeholder="e.g. Kamala Shetty" />
                </div>
                <div>
                  <label htmlFor="cv-email" className={labelCls}>Email</label>
                  <input id="cv-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={field} placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="cv-phone" className={labelCls}>Mobile number</label>
                  <div className="flex">
                    <span className="flex items-center rounded-l-[12px] border border-r-0 border-white/10 bg-white/[0.08] px-3.5 text-sm text-white/70">+91</span>
                    <input id="cv-phone" type="tel" inputMode="tel" required autoComplete="tel-national" value={form.phone} onChange={set('phone')}
                      className={`${field} rounded-l-none`} placeholder="98765 43210" pattern="[0-9+\s\-]{10,16}" title="A 10-digit mobile number" />
                  </div>
                </div>
                <div>
                  <label htmlFor="cv-pass" className={labelCls}>Password</label>
                  <Password id="cv-pass" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="At least 8 characters" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="cv-ident" className={labelCls}>Email or mobile number</label>
                  <input id="cv-ident" required autoComplete="username" value={form.ident} onChange={set('ident')} className={field} placeholder="you@example.com or 98765 43210" autoFocus />
                </div>
                <div>
                  <label htmlFor="cv-signin-pass" className={labelCls}>Password</label>
                  <Password id="cv-signin-pass" required autoComplete="current-password" value={form.password} onChange={set('password')} placeholder="Your password" />
                </div>
              </>
            )}
            <button type="submit" disabled={busy}
              className="w-full rounded-full bg-[#FFB224] py-3.5 text-base font-extrabold text-[#0B0B0D] shadow-[0_10px_30px_-8px_rgba(255,178,36,.6)] transition hover:bg-[#FFC24D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFB224]/40 disabled:opacity-60">
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/55">
            {mode === 'signin' ? 'New to SwaraVeda? ' : 'Already have an account? '}
            <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="font-bold text-[#FFB224] hover:text-white">
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
