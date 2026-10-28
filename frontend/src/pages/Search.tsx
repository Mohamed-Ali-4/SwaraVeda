import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HiOutlineSearch, HiOutlinePlay, HiOutlinePause, HiOutlineArrowRight, HiOutlineSparkles } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useDialects } from '../lib/dialects';
import { clock } from '../lib/format';
import { useNlpStatus } from '../lib/nlp';
import { usePassagePlayer } from '../lib/player';
import { input } from '../lib/styles';
import type { SearchHit } from '../lib/types';
import { Alert, Button, Chip, EmptyState, PageHeader, Spinner } from '../components/ui';
import Highlight from '../components/Highlight';

type Mode = 'keyword' | 'semantic';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const mode: Mode = params.get('mode') === 'semantic' ? 'semantic' : 'keyword';
  const dialectId = params.get('dialect') ?? '';
  const [draft, setDraft] = useState(q);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nlp = useNlpStatus();
  const { dialects } = useDialects();
  const passage = usePassagePlayer();
  const semanticOff = nlp?.semantic_search === false;

  useEffect(() => setDraft(q), [q]);

  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(mode === 'semantic' ? '/search/semantic' : '/search', { params: { q, dialect_id: dialectId || undefined, limit: 30 } })
      .then((res) => !cancelled && setHits(res.data.hits))
      .catch((err) => { if (!cancelled) { setHits(null); setError(errorMessage(err, 'Search failed')); } })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, mode, dialectId]);

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update({ q: draft.trim() });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Search"
        title="Find a word, a phrase, a story"
        subtitle="Search everything people have transcribed. Type in any script: ಮಳೆ, बारिश or rain."
      />

      <form onSubmit={submit} className="rounded-card border border-line bg-surface p-3 shadow-card" role="search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <HiOutlineSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={mode === 'semantic' ? 'Describe what you’re looking for, e.g. songs about rain' : 'Words that were said'}
              aria-label="Search the archive"
              autoFocus
              className={`${input} pl-11 text-base`}
            />
          </div>
          <Button type="submit" size="lg" className="px-5">Search</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
          <div className="flex rounded-lg bg-sunken p-1" role="radiogroup" aria-label="Search mode">
            <button type="button" role="radio" aria-checked={mode === 'keyword'} onClick={() => update({ mode: '' })}
              className={`rounded-md px-3 py-1 text-sm ${mode === 'keyword' ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted'}`}>
              Exact words
            </button>
            <button type="button" role="radio" aria-checked={mode === 'semantic'} disabled={semanticOff}
              onClick={() => update({ mode: 'semantic' })}
              title={semanticOff ? 'Not switched on for this archive yet' : 'Finds passages with a similar meaning, even in other words'}
              className={`flex items-center gap-1 rounded-md px-3 py-1 text-sm disabled:opacity-50 ${mode === 'semantic' ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted'}`}>
              <HiOutlineSparkles className="w-4 h-4 text-lotus-500" /> By meaning
            </button>
          </div>
          <select value={dialectId} onChange={(e) => update({ dialect: e.target.value })} aria-label="Dialect"
            className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink-soft">
            <option value="">All dialects</option>
            {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {semanticOff && <span className="text-xs text-faint">Search by meaning isn’t switched on yet.</span>}
        </div>
      </form>

      <div className="mt-8" aria-live="polite">
        {error && <Alert>{error}</Alert>}
        {loading && <div className="flex justify-center py-12 text-saffron-500"><Spinner className="w-7 h-7 border-[3px]" /></div>}

        {!loading && hits === null && !error && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: 'Exact words', text: 'Finds passages containing what you type, in transcripts and corrections.' },
              { title: 'By meaning', text: 'Describe a topic in English or your language; finds related passages.' },
              { title: 'Listen right away', text: 'Every result plays just that passage, then opens at that moment.' },
            ].map((t) => (
              <div key={t.title} className="rounded-xl border border-line bg-surface/60 p-4">
                <p className="font-semibold text-ink">{t.title}</p>
                <p className="mt-1 text-sm text-muted">{t.text}</p>
              </div>
            ))}
          </div>
        )}

        {!loading && hits && (hits.length === 0 ? (
          <EmptyState icon={<HiOutlineSearch className="w-7 h-7" />} title={`Nothing found for “${q}”`}>
            {mode === 'keyword' && !semanticOff
              ? <>Try fewer words, another spelling, or <button className="font-medium text-saffron-600" onClick={() => update({ mode: 'semantic' })}>search by meaning</button>.</>
              : 'Try fewer words or another spelling. Only public recordings are searchable.'}
          </EmptyState>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{hits.length} passage{hits.length === 1 ? '' : 's'}{hits.length === 30 ? ' (top 30)' : ''}</p>
            <ol className="space-y-3">
              {hits.map((hit) => {
                const playing = passage.playingId === hit.segment_id;
                return (
                  <li key={hit.segment_id} className={`rounded-card border bg-surface p-4 sm:p-5 shadow-card transition ${playing ? 'border-saffron-300' : 'border-line'}`}>
                    <div className="flex gap-4">
                      <button
                        onClick={() => passage.toggle(hit.segment_id, hit.audio_url, hit.start_ms, hit.end_ms)}
                        disabled={!hit.audio_url}
                        aria-label={playing ? 'Stop' : `Play passage from ${hit.recording_title}`}
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                          playing ? 'bg-saffron-600 text-white' : 'bg-saffron-50 text-saffron-600 hover:bg-saffron-100'
                        } disabled:opacity-40`}
                      >
                        {playing ? <HiOutlinePause className="w-5 h-5" /> : <HiOutlinePlay className="w-5 h-5 translate-x-px" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="font-script text-[1.08rem] leading-relaxed text-ink">
                          <Highlight text={hit.text || ''} query={mode === 'keyword' ? q : ''} />
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                          {hit.dialect_name && <Chip className="bg-saffron-50 text-saffron-700">{hit.dialect_name}</Chip>}
                          <span className="truncate">{hit.recording_title}</span>
                          <span className="font-mono text-xs tabular">{clock(hit.start_ms)}–{clock(hit.end_ms)}</span>
                          {mode === 'semantic' && <span className="text-xs text-lotus-600">{Math.round(hit.score * 100)}% match</span>}
                          <Link to={`/recordings/${hit.recording_id}?seg=${hit.segment_id}`} className="ml-auto flex items-center gap-1 font-medium text-saffron-600 hover:text-saffron-700">
                            Open here <HiOutlineArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        ))}
      </div>
    </div>
  );
}
