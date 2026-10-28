import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HiOutlineMicrophone, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineSearch, HiOutlineCollection } from 'react-icons/hi';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { capitalize } from '../lib/format';
import { genres, type Recording } from '../lib/types';
import { ButtonLink, EmptyState, PageHeader, PageSpinner } from '../components/ui';
import RecordingCard from '../components/RecordingCard';

const statuses = [
  { value: 'transcribed', label: 'Needs review' },
  { value: 'verified', label: 'Verified' },
  { value: 'transcribing', label: 'Transcribing' },
  { value: 'uploaded', label: 'Not transcribed' },
];
const PAGE_SIZE = 12;
const selectClass = 'rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink-soft focus:border-saffron-500 focus:outline-none';

export default function Recordings() {
  const { user } = useAuth();
  const { dialects, nameOf } = useDialects();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';
  const dialect = params.get('dialect') ?? '';
  const status = params.get('status') ?? '';
  const genre = params.get('genre') ?? '';
  const [draft, setDraft] = useState(q);
  const [items, setItems] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (!('page' in next)) p.delete('page');
    setParams(p, { replace: true });
  };

  // Search titles as the user types, after a short pause.
  useEffect(() => {
    if (draft === q) return;
    const t = window.setTimeout(() => update({ q: draft.trim() }), 350);
    return () => window.clearTimeout(t);
  }, [draft]); // oxlint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    api.get('/recordings', {
      params: {
        page, page_size: PAGE_SIZE, q: q || undefined, dialect_id: dialect || undefined,
        status: status || undefined, genre: genre || undefined,
      },
    })
      .then((res) => { setItems(res.data.items); setTotal(res.data.total); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, q, dialect, status, genre, user]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const filtered = !!(q || dialect || status || genre);

  return (
    <div>
      <PageHeader
        eyebrow="The archive"
        title="Recordings"
        subtitle="Songs, stories, prayers and conversations, recorded by the people who speak them."
        actions={user && <ButtonLink to="/recordings/new" icon={<HiOutlineMicrophone className="w-5 h-5" />}>New recording</ButtonLink>}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search titles and speakers"
            aria-label="Search titles and speakers"
            className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-saffron-500 focus:outline-none"
          />
        </div>
        <select value={dialect} onChange={(e) => update({ dialect: e.target.value })} aria-label="Dialect" className={selectClass}>
          <option value="">All dialects</option>
          {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={status} onChange={(e) => update({ status: e.target.value })} aria-label="Status" className={selectClass}>
          <option value="">Any status</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={genre} onChange={(e) => update({ genre: e.target.value })} aria-label="Kind" className={selectClass}>
          <option value="">Any kind</option>
          {genres.map((g) => <option key={g} value={g}>{capitalize(g)}</option>)}
        </select>
        {filtered && (
          <button onClick={() => { setDraft(''); setParams({}, { replace: true }); }} className="px-2 text-sm font-medium text-saffron-600 hover:text-saffron-700">
            Clear filters
          </button>
        )}
      </div>

      {loading ? <PageSpinner /> : items.length === 0 ? (
        filtered ? (
          <EmptyState icon={<HiOutlineSearch className="w-7 h-7" />} title="No recordings match">
            Try removing a filter or searching for something else.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<HiOutlineCollection className="w-7 h-7" />}
            title="The archive is empty, for now"
            action={<ButtonLink to={user ? '/recordings/new' : '/register'} icon={<HiOutlineMicrophone className="w-5 h-5" />}>Add the first recording</ButtonLink>}
          >
            Every archive starts with one voice. Record a song, a story or a conversation in your dialect.
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">{total} recording{total === 1 ? '' : 's'}</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((rec) => <RecordingCard key={rec.id} rec={rec} dialect={nameOf(rec.dialect_id)} />)}
          </div>
          {pages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
              <button onClick={() => update({ page: String(page - 1) })} disabled={page === 1}
                className="rounded-lg border border-line-strong bg-surface p-2 text-ink-soft hover:bg-sunken disabled:opacity-40" aria-label="Previous page">
                <HiOutlineChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted tabular">Page {page} of {pages}</span>
              <button onClick={() => update({ page: String(page + 1) })} disabled={page >= pages}
                className="rounded-lg border border-line-strong bg-surface p-2 text-ink-soft hover:bg-sunken disabled:opacity-40" aria-label="Next page">
                <HiOutlineChevronRight className="w-5 h-5" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
