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
import { ButtonLink, Card } from '../components/ui';
import { Spine } from '../components/TapeArt';
import { toShelf } from '../lib/dialectInfo';
import type { Dialect } from '../lib/types';
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

/** A row of tape spines from the dialect shelf; each one rises when pointed at. */
function MiniShelf({ dialects }: { dialects: Dialect[] }) {
  const spines = toShelf(dialects).slice(0, 18);
  return (
    <Link to="/dialects" aria-label="Open the dialect shelf" className="mt-8 flex h-[260px] items-end gap-[5px] overflow-hidden pb-2 no-underline">
      {spines.map((d, i) => (
        <span
          key={d.id}
          title={d.name}
          className="rise h-[240px] w-[41px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_18px_30px_-20px_rgba(20,16,10,.6)] transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-y-3 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
          style={{ animationDelay: `${i * 35}ms` }}
        >
          <Spine d={d} />
        </span>
      ))}
    </Link>
  );
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
          <p className="rise lbl mb-6 inline-flex h-[21px] items-center border border-saffron-600 px-2 text-saffron-600">
            {user ? `Welcome back, ${user.display_name.split(' ')[0]}` : 'A community archive for endangered dialects'}
          </p>
          <h1 className="rise rise-2 text-[3rem] font-normal leading-[1] tracking-[-0.03em] text-ink sm:text-[4.4rem]">
            Every voice you record keeps a language <em className="text-saffron-600">alive.</em>
          </h1>
          <p className="rise rise-3 mt-6 max-w-xl font-display text-[19px] leading-relaxed text-ink-soft">
            SwaraVeda gathers the songs, stories and everyday speech of India’s endangered dialects,
            turns them into searchable text with speech AI, and lets the communities who speak them
            check every word.
          </p>
          <div className="rise rise-4 mt-8 flex flex-wrap gap-3">
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
        <div className="rise rise-3"><HeroIllustration /></div>
      </section>

      <section aria-label="Archive in numbers">
        {hasData ? (
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-ink/85 bg-ink/85 sm:grid-cols-4">
            {[
              { label: 'hours of speech', value: hours(stats.total_seconds) },
              { label: 'recordings', value: stats.recordings },
              { label: 'passages verified', value: stats.verified_segments },
              { label: 'dialects', value: stats.dialects },
            ].map((s) => (
              <div key={s.label} className="bg-paper px-6 py-5">
                <dd className="font-display text-[2.6rem] leading-none text-ink tabular">{s.value}</dd>
                <dt className="lbl mt-2 text-muted">{s.label}</dt>
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
        <h2 className="border-b border-ink/85 pb-3 text-[2rem] font-normal text-ink">How it works</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="group relative border border-ink/85 bg-surface p-6 transition-transform duration-500 hover:-translate-y-1">
              <span className="absolute right-5 top-3 font-display text-5xl text-saffron-600/25">{i + 1}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-saffron-600 text-saffron-600 transition-colors duration-500 group-hover:bg-saffron-600 group-hover:text-white">
                <s.icon className="w-5 h-5" />
              </span>
              <h3 className="mt-4 text-2xl font-normal text-ink">{s.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-[2rem] font-normal text-ink">Recently added</h2>
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
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/85 pb-3">
            <div>
              <h2 className="text-[2rem] font-normal text-ink">Dialects on the shelf</h2>
              <p className="mt-1 font-display text-[17px] text-ink-soft">Speak one of these, or one that’s missing? Add your voice.</p>
            </div>
            <ButtonLink to="/dialects" variant="secondary" size="sm">Open the shelf</ButtonLink>
          </div>
          <MiniShelf dialects={dialects} />
        </section>
      )}

    </div>
  );
}
