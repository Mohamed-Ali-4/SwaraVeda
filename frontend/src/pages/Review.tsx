import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiOutlinePlay, HiOutlinePause, HiOutlinePencil, HiOutlineBadgeCheck, HiOutlineClipboardCheck } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { clock } from '../lib/format';
import { usePassagePlayer } from '../lib/player';
import { useToast } from '../lib/toast';
import type { Segment } from '../lib/types';
import { Button, Chip, EmptyState, PageHeader, PageSpinner } from '../components/ui';

type State = 'needs_correction' | 'needs_verification' | 'verified';
interface Item { segment: Segment; recording_id: string; recording_title: string; audio_url?: string; dialect_name?: string }

const tabs: { key: State; label: string; help: string }[] = [
  { key: 'needs_correction', label: 'Needs correcting', help: 'AI drafts nobody has checked yet. Listen and fix what was really said.' },
  { key: 'needs_verification', label: 'Ready to verify', help: 'Corrected by a speaker. A verifier gives the final approval.' },
  { key: 'verified', label: 'Verified', help: 'Approved passages: these go into the archive’s dataset.' },
];

export default function Review() {
  const { user } = useAuth();
  const toast = useToast();
  const { dialects } = useDialects();
  const [params, setParams] = useSearchParams();
  const isVerifier = user?.role === 'verifier' || user?.role === 'admin';
  const state = (params.get('state') as State) || (isVerifier ? 'needs_verification' : 'needs_correction');
  const dialect = params.get('dialect') ?? '';
  const [items, setItems] = useState<Item[]>([]);
  const [counts, setCounts] = useState<Record<State, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const passage = usePassagePlayer();

  useEffect(() => {
    setLoading(true);
    api.get('/review/segments', { params: { state, dialect_id: dialect || undefined, limit: 100 } })
      .then((res) => { setItems(res.data.items); setCounts(res.data.counts); })
      .finally(() => setLoading(false));
  }, [state, dialect]);

  const set = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  const verify = async (item: Item) => {
    try {
      await api.post(`/segments/${item.segment.id}/verify`);
      setItems((prev) => prev.filter((i) => i.segment.id !== item.segment.id));
      setCounts((c) => c && { ...c, needs_verification: c.needs_verification - 1, verified: c.verified + 1 });
      toast.success('Verified.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not verify'));
    }
  };

  const tab = tabs.find((t) => t.key === state)!;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Review"
        title="Help check the transcripts"
        subtitle="Each passage takes under a minute: listen, then correct or approve. Native speakers make the archive trustworthy."
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap pl-px" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={state === t.key} onClick={() => set({ state: t.key })}
              className={`lbl -ml-px flex h-[27px] items-center border px-3 transition-colors duration-500 ${
                state === t.key ? 'relative z-10 border-saffron-600 bg-saffron-600 text-white' : 'border-ink/85 text-ink hover:bg-ink hover:text-paper'
              }`}>
              {t.label}{counts && <span className="ml-1.5 tabular opacity-70">{counts[t.key]}</span>}
            </button>
          ))}
        </div>
        <select value={dialect} onChange={(e) => set({ dialect: e.target.value })} aria-label="Dialect"
          className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-soft">
          <option value="">All dialects</option>
          {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <p className="mb-6 text-sm text-muted">{tab.help}</p>

      {loading ? <PageSpinner /> : items.length === 0 ? (
        <EmptyState icon={<HiOutlineClipboardCheck className="w-7 h-7" />} title={state === 'verified' ? 'Nothing verified yet' : 'All caught up'}>
          {state === 'needs_correction' ? 'Every AI draft has been checked. New recordings will show up here.'
            : state === 'needs_verification' ? 'No corrections are waiting for approval.' : 'Approved passages will be listed here.'}
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {items.map((item) => {
            const s = item.segment;
            const playing = passage.playingId === s.id;
            return (
              <li key={s.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex gap-4">
                  <button onClick={() => passage.toggle(s.id, item.audio_url, s.start_ms, s.end_ms)} disabled={!item.audio_url}
                    aria-label={playing ? 'Stop' : 'Play passage'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${playing ? 'bg-saffron-600 text-white' : 'bg-saffron-50 text-saffron-600 hover:bg-saffron-100'} disabled:opacity-40`}>
                    {playing ? <HiOutlinePause className="w-5 h-5" /> : <HiOutlinePlay className="w-5 h-5 translate-x-px" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-script text-[1.05rem] leading-relaxed text-ink">{s.corrected_text || s.asr_text}</p>
                    {s.corrected_text && s.asr_text !== s.corrected_text && (
                      <p className="text-xs text-faint"><span className="font-medium">AI heard:</span> <span className="line-through">{s.asr_text}</span></p>
                    )}
                    {s.translation_en && <p className="text-sm text-river-600">{s.translation_en}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      {item.dialect_name && <Chip className="bg-saffron-50 text-saffron-700">{item.dialect_name}</Chip>}
                      <Link to={`/recordings/${item.recording_id}?seg=${s.id}`} className="truncate text-ink-soft hover:text-saffron-700">{item.recording_title}</Link>
                      <span className="font-mono text-xs tabular">{clock(s.start_ms)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                    {state !== 'verified' && (
                      <Link to={`/recordings/${item.recording_id}?seg=${s.id}&edit=1`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-sm font-medium text-ink no-underline hover:bg-sunken">
                        <HiOutlinePencil className="w-4 h-4" /> {state === 'needs_correction' ? 'Correct' : 'Edit'}
                      </Link>
                    )}
                    {state === 'needs_verification' && isVerifier && (
                      <Button size="sm" variant="verify" onClick={() => verify(item)} icon={<HiOutlineBadgeCheck className="w-4 h-4" />}>Verify</Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
