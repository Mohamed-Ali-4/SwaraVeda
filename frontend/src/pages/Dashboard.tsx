import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HiOutlineMicrophone, HiOutlineSparkles, HiOutlineBadgeCheck, HiOutlineArrowRight, HiOutlineCollection,
  HiOutlineClipboardCheck,
} from 'react-icons/hi';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import type { Recording } from '../lib/types';
import { ButtonLink, Card, LotusMark } from '../components/ui';
import RecordingCard from '../components/RecordingCard';

interface Stats {
  recordings: number;
  verified_recordings: number;
  segments: number;
  verified_segments: number;
  dialects: number;
  contributors: number;
  total_seconds: number;
}

// Fixed bar heights for the illustration's waveform.
const bars = [18, 30, 44, 26, 52, 38, 60, 34, 22, 46, 58, 40, 28, 50, 36, 20, 42, 56, 30, 24, 48, 34, 18, 38, 52, 28, 44, 22];

function HeroIllustration() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[28px] bg-gradient-to-br from-saffron-100 via-lotus-50 to-paper" />
      <Card className="p-5 sm:p-6 shadow-lift">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium uppercase tracking-[0.06em] text-saffron-600">Tulu · Paddana · Example</span>
          <span className="rounded-full bg-leaf-50 px-2 py-0.5 font-medium text-leaf-700">Verified</span>
        </div>
        <div className="mt-4 flex h-16 items-center gap-[3px]" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} className={`w-full rounded-full ${i < 11 ? 'bg-saffron-500' : 'bg-line-strong'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-saffron-300 bg-saffron-50 p-3.5">
            <p className="font-mono text-[11px] text-muted">0:05 – 0:11</p>
            <p className="mt-1 text-[13px] text-faint line-through">ಬಲ್ಲಾಳ ಕೋಟೆ ಮಳೆ</p>
            <p className="font-script text-lg font-semibold text-ink">ಬಲ್ಲಾಳ ಕೋಟೆಡ್ ಮಳೆ</p>
            <p className="text-sm text-river-600">Rain at the Ballala fort</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <HiOutlineSparkles className="w-4 h-4 text-lotus-500" />
            AI drafted it · a native speaker corrected it · a verifier approved it
          </div>
        </div>
      </Card>
    </div>
  );
}

const steps = [
  {
    icon: HiOutlineMicrophone, title: 'Record a voice',
    text: 'Record an elder’s song, a story or a conversation on your phone, or upload a file you already have.',
  },
  {
    icon: HiOutlineSparkles, title: 'AI writes a first draft',
    text: 'Speech AI listens and writes a timestamped transcript in minutes, with a suggested English translation.',
  },
  {
    icon: HiOutlineBadgeCheck, title: 'Speakers make it right',
    text: 'People who speak the dialect fix the draft line by line while listening; verifiers approve it.',
  },
];

function hours(seconds: number) {
  const h = seconds / 3600;
  return h >= 10 ? Math.round(h).toString() : h >= 1 ? h.toFixed(1) : `${Math.round(seconds / 60)} min`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { dialects, nameOf } = useDialects();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Recording[]>([]);
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    api.get('/stats').then((res) => setStats(res.data)).catch(() => {});
    api.get('/recordings', { params: { page_size: 6 } }).then((res) => setRecent(res.data.items)).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const isVerifier = user.role === 'verifier' || user.role === 'admin';
    api.get('/review/segments', { params: { limit: 1 } })
      .then((res) => setWaiting(res.data.counts[isVerifier ? 'needs_verification' : 'needs_correction']))
      .catch(() => {});
  }, [user]);

  const hasData = stats && stats.recordings > 0;

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-saffron-100 bg-saffron-50 px-3 py-1 text-sm font-medium text-saffron-700">
            <LotusMark className="w-4 h-4" />
            {user ? `Welcome back, ${user.display_name.split(' ')[0]}` : 'A community archive for endangered dialects'}
          </p>
          <h1 className="text-[2.6rem] sm:text-[3.4rem] font-extrabold leading-[1.05] tracking-tight text-ink">
            Every voice you record keeps a language <span className="text-saffron-600">alive.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
            SwaraVeda gathers the songs, stories and everyday speech of India’s endangered dialects,
            turns them into searchable text with speech AI, and lets the communities who speak them
            check every word.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <>
                <ButtonLink to="/recordings/new" size="lg" icon={<HiOutlineMicrophone className="w-5 h-5" />}>Record a voice</ButtonLink>
                <ButtonLink to="/review" size="lg" variant="secondary" icon={<HiOutlineClipboardCheck className="w-5 h-5" />}>
                  {waiting ? `Review ${waiting} passage${waiting === 1 ? '' : 's'}` : 'Review transcripts'}
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink to="/register" size="lg">Join the archive</ButtonLink>
                <ButtonLink to="/recordings" size="lg" variant="secondary" icon={<HiOutlineCollection className="w-5 h-5" />}>Explore recordings</ButtonLink>
              </>
            )}
          </div>
        </div>
        <HeroIllustration />
      </section>

      <section aria-label="Archive in numbers">
        {hasData ? (
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
            {[
              { label: 'hours of speech', value: hours(stats.total_seconds) },
              { label: 'recordings', value: stats.recordings },
              { label: 'passages verified', value: stats.verified_segments },
              { label: 'dialects', value: stats.dialects },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-6 py-5">
                <dd className="font-display text-3xl font-bold text-ink tabular">{s.value}</dd>
                <dt className="text-sm text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        ) : stats && (
          <Card className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <p className="text-ink-soft"><span className="font-semibold text-ink">The archive is just getting started.</span> The first recordings shape everything that follows.</p>
            <ButtonLink to={user ? '/recordings/new' : '/register'} variant="secondary" size="sm">Add the first recording</ButtonLink>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold text-ink">How it works</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-card border border-line bg-surface p-6 shadow-card">
              <span className="absolute right-5 top-4 font-display text-4xl font-bold text-line">{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-saffron-50 text-saffron-600">
                <s.icon className="w-6 h-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold text-ink">Recently added</h2>
            <Link to="/recordings" className="flex items-center gap-1 text-[15px] font-medium text-saffron-600 hover:text-saffron-700">
              Whole archive <HiOutlineArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((r) => <RecordingCard key={r.id} rec={r} dialect={nameOf(r.dialect_id)} />)}
          </div>
        </section>
      )}

      {dialects.length > 0 && (
        <section className="rounded-[20px] bg-saffron-900 px-6 py-10 sm:px-10 text-saffron-50">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">Dialects in the archive</h2>
              <p className="mt-1 text-saffron-100/80">Speak one of these, or one that’s missing? Add your voice.</p>
            </div>
            <ButtonLink to="/dialects" variant="secondary" size="sm">All dialects</ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {dialects.slice(0, 16).map((d) => (
              <li key={d.id} className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[15px]">
                {d.name}{d.region && <span className="text-saffron-100/60"> · {d.region}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
