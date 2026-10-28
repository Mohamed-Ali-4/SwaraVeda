import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  HiOutlinePlay, HiOutlinePause, HiOutlineSparkles, HiOutlineChevronLeft, HiOutlineLockClosed,
  HiOutlineGlobe, HiOutlinePencilAlt, HiOutlineTrash, HiOutlineLocationMarker, HiOutlineUser,
  HiOutlineCalendar, HiOutlineClock, HiOutlineRewind, HiOutlineFastForward, HiOutlineExclamation,
} from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { capitalize, clock, date, duration } from '../lib/format';
import { useNlpStatus } from '../lib/nlp';
import { loadPeaks, useAudioPlayer } from '../lib/player';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import { genres, type Job, type Recording, type Segment } from '../lib/types';
import { Alert, Button, Card, Chip, EmptyState, Field, Kbd, PageSpinner, StatusBadge } from '../components/ui';
import Waveform from '../components/Waveform';
import SegmentItem from '../components/SegmentItem';
import { segmentState, type SegmentState } from '../lib/segments';
import RecordingTags from '../components/RecordingTags';

const isActiveJob = (job: Job | null) => job?.status === 'queued' || job?.status === 'running';
type Filter = 'all' | SegmentState;

function JobBanner({ job, workerMode }: { job: Job; workerMode: boolean }) {
  const label = job.status === 'queued'
    ? workerMode ? 'Waiting for the transcription worker to pick this up…' : 'Queued for transcription…'
    : job.progress < 25 ? 'Preparing the audio…' : job.progress < 70 ? 'AI is listening and writing the transcript…' : 'Almost done: saving passages…';
  return (
    <div className="rounded-xl border border-river-100 bg-river-50 p-4" aria-live="polite">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm text-river-600">
        <span className="flex items-center gap-2 font-medium"><HiOutlineSparkles className="w-4 h-4" />{label}</span>
        <span className="tabular">{job.progress}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-river-500 transition-all duration-700" style={{ width: `${Math.max(4, job.progress)}%` }} />
      </div>
    </div>
  );
}

function DetailsEditor({ rec, onSaved, onClose }: { rec: Recording; onSaved: (r: Recording) => void; onClose: () => void }) {
  const toast = useToast();
  const { dialects } = useDialects();
  const [form, setForm] = useState({
    title: rec.title, dialect_id: rec.dialect_id || '', genre: rec.genre || '', speaker_name: rec.speaker_name || '',
    notes: rec.notes || '', consent_public: rec.consent_public, consent_ai_training: rec.consent_ai_training,
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch(`/recordings/${rec.id}`, {
        ...form,
        dialect_id: form.dialect_id || null,
        genre: form.genre || null,
        speaker_name: form.speaker_name || null,
        notes: form.notes || null,
      });
      toast.success('Details saved.');
      onSaved(res.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save details'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-line pt-6">
      <Field label="Title" htmlFor="ed-title">
        <input id="ed-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={input} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dialect" htmlFor="ed-dialect">
          <select id="ed-dialect" value={form.dialect_id} onChange={(e) => setForm({ ...form, dialect_id: e.target.value })} className={input}>
            <option value="">Not set</option>
            {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Kind" htmlFor="ed-genre">
          <select id="ed-genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className={input}>
            <option value="">Not set</option>
            {genres.map((g) => <option key={g} value={g}>{capitalize(g)}</option>)}
          </select>
        </Field>
        <Field label="Speaker" htmlFor="ed-speaker">
          <input id="ed-speaker" value={form.speaker_name} onChange={(e) => setForm({ ...form, speaker_name: e.target.value })} className={input} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="ed-notes">
        <textarea id="ed-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} resize-y`} />
      </Field>
      <div className="space-y-2 rounded-xl bg-sunken p-4">
        <p className="text-sm font-medium text-ink-soft">What the speaker agreed to</p>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={form.consent_public} onChange={(e) => setForm({ ...form, consent_public: e.target.checked })} className="h-5 w-5 accent-saffron-600" />
          Anyone may listen (public in the archive and search)
        </label>
        <label className="flex items-center gap-3 text-[15px]">
          <input type="checkbox" checked={form.consent_ai_training} onChange={(e) => setForm({ ...form, consent_ai_training: e.target.checked })} className="h-5 w-5 accent-saffron-600" />
          May be used to train speech AI
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>Save details</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function RecordingDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const nlp = useNlpStatus();
  const { nameOf } = useDialects();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(params.get('seg'));
  const [filter, setFilter] = useState<Filter>('all');
  const [follow, setFollow] = useState(true);
  const [editDetails, setEditDetails] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [starting, setStarting] = useState(false);
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

  const player = useAudioPlayer(recording?.audio_url);

  const load = useCallback(() =>
    api.get(`/recordings/${id}`).then((res) => {
      setRecording(res.data.recording);
      setSegments(res.data.segments);
      setJob(res.data.latest_job);
    }), [id]);

  useEffect(() => {
    load().catch((err) => { if (err.response?.status === 404) setNotFound(true); }).finally(() => setLoading(false));
  }, [load]);

  const jobActive = isActiveJob(job);
  useEffect(() => {
    if (!jobActive) return;
    const timer = window.setInterval(() => load().catch(() => {}), 3000);
    return () => window.clearInterval(timer);
  }, [jobActive, load]);

  useEffect(() => {
    if (recording?.audio_url) loadPeaks(recording.audio_url).then(setPeaks);
  }, [recording?.audio_url]);

  // Deep link from search: ?seg=<id> scrolls to and cues that passage.
  const { seek } = player;
  useEffect(() => {
    const target = params.get('seg');
    const seg = segments.find((s) => s.id === target);
    if (!seg) return;
    setFocusId(seg.id);
    // From the review queue, "Correct" opens the editor straight away.
    if (params.get('edit') && user) setEditingId(seg.id);
    else seek(seg.start_ms);
    requestAnimationFrame(() => itemRefs.current.get(seg.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    // Runs when the passages first arrive, not on every edit.
  }, [segments.length > 0, params]); // oxlint-disable-line react-hooks/exhaustive-deps

  const activeId = useMemo(() => {
    if (!player.playing && player.time === 0) return undefined;
    return segments.find((s) => player.time >= s.start_ms && player.time < s.end_ms)?.id;
  }, [segments, player.time, player.playing]);

  useEffect(() => {
    if (follow && player.playing && activeId && !editingId) {
      itemRefs.current.get(activeId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId, follow, player.playing, editingId]);

  const counts = useMemo(() => {
    const c = { all: segments.length, draft: 0, corrected: 0, verified: 0 };
    segments.forEach((s) => c[segmentState(s)]++);
    return c;
  }, [segments]);
  const visible = filter === 'all' ? segments : segments.filter((s) => segmentState(s) === filter);

  const canEdit = !!user;
  const canVerify = user?.role === 'verifier' || user?.role === 'admin';
  const canManage = !!user && (recording?.contributor_id === user.id || canVerify);
  const canDelete = !!user && (recording?.contributor_id === user.id || user.role === 'admin');

  // Keyboard: Space play/pause, ←/→ 5 s, J/K previous/next passage, E correct.
  const { toggle, playRange } = player;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      // A focused button or the waveform handles Space and arrows itself.
      if ((e.key === ' ' || e.key.startsWith('Arrow')) && t.closest('button, a, [role="slider"]')) return;
      const idx = segments.findIndex((s) => s.id === (activeId ?? focusId));
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') seek(player.time + 5000);
      else if (e.key === 'ArrowLeft') seek(player.time - 5000);
      else if (e.key === 'j' || e.key === 'k') {
        const next = segments[Math.min(segments.length - 1, Math.max(0, idx + (e.key === 'j' ? 1 : -1)))];
        if (next) { setFocusId(next.id); playRange(next.start_ms, next.end_ms); itemRefs.current.get(next.id)?.scrollIntoView({ block: 'nearest' }); }
      } else if (e.key === 'e' && canEdit && idx >= 0) { e.preventDefault(); setEditingId(segments[idx].id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [segments, activeId, focusId, toggle, seek, playRange, player.time, canEdit]);

  const onSaved = (seg: Segment, goNext: boolean) => {
    const updated = segments.map((s) => (s.id === seg.id ? seg : s));
    setSegments(updated);
    if (goNext) {
      const idx = updated.findIndex((s) => s.id === seg.id);
      const next = updated.slice(idx + 1).find((s) => segmentState(s) !== 'verified');
      setEditingId(next?.id ?? null);
      if (next) {
        setFocusId(next.id);
        requestAnimationFrame(() => itemRefs.current.get(next.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        playRange(next.start_ms, next.end_ms);
      } else toast.success('That was the last passage left to correct.');
    } else setEditingId(null);
  };

  const startTranscription = async () => {
    setStarting(true);
    try {
      const res = await api.post(`/recordings/${id}/transcribe`);
      setJob(res.data);
      setRecording((r) => (r ? { ...r, status: 'transcribing' } : r));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start transcription'));
    } finally {
      setStarting(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/recordings/${id}`);
      toast.success('Recording deleted.');
      navigate('/recordings');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete'));
    }
  };

  if (loading) return <PageSpinner />;
  if (notFound || !recording) {
    return (
      <EmptyState icon={<HiOutlineLockClosed className="w-7 h-7" />} title="Recording not found"
        action={<Link to="/recordings" className="font-medium text-saffron-600">Back to the archive</Link>}>
        It may have been deleted, or it’s private and you’re not signed in as someone who can see it.
      </EmptyState>
    );
  }

  const dialect = nameOf(recording.dialect_id);
  const progress = counts.all ? Math.round(((counts.corrected + counts.verified) / counts.all) * 100) : 0;
  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'draft', label: 'AI draft', count: counts.draft },
    { key: 'corrected', label: 'Corrected', count: counts.corrected },
    { key: 'verified', label: 'Verified', count: counts.verified },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/recordings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink no-underline">
        <HiOutlineChevronLeft className="w-4 h-4" /> Archive
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-saffron-600">
              {[dialect, recording.genre && capitalize(recording.genre)].filter(Boolean).join(' · ') || 'Recording'}
            </p>
            <h1 className="mt-1.5 text-[1.9rem] font-bold leading-tight text-ink">{recording.title}</h1>
          </div>
          <StatusBadge status={recording.status} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          {recording.speaker_name && <span className="flex items-center gap-1.5"><HiOutlineUser className="w-4 h-4" />{recording.speaker_name}{recording.speaker_age_group && ` (${recording.speaker_age_group})`}</span>}
          {recording.recorded_place && <span className="flex items-center gap-1.5"><HiOutlineLocationMarker className="w-4 h-4" />{recording.recorded_place}</span>}
          <span className="flex items-center gap-1.5"><HiOutlineCalendar className="w-4 h-4" />{date(recording.recorded_at || recording.created_at)}</span>
          {recording.duration_seconds ? <span className="flex items-center gap-1.5 tabular"><HiOutlineClock className="w-4 h-4" />{duration(recording.duration_seconds)}</span> : null}
          {recording.consent_public
            ? <span className="flex items-center gap-1.5"><HiOutlineGlobe className="w-4 h-4" />Public</span>
            : <span className="flex items-center gap-1.5 text-saffron-700"><HiOutlineLockClosed className="w-4 h-4" />Private</span>}
          {recording.consent_ai_training && <Chip className="bg-lotus-50 text-lotus-600">OK for AI training</Chip>}
        </div>
        {recording.notes && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">{recording.notes}</p>}
        <RecordingTags recordingId={recording.id} canEdit={!!user} />

        {(canManage || canDelete) && !editDetails && (
          <div className="mt-5 flex flex-wrap gap-2">
            {canManage && <Button size="sm" variant="secondary" onClick={() => setEditDetails(true)} icon={<HiOutlinePencilAlt className="w-4 h-4" />}>Edit details & consent</Button>}
            {canDelete && !confirmDelete && <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} icon={<HiOutlineTrash className="w-4 h-4" />}>Delete</Button>}
            {confirmDelete && (
              <span className="flex flex-wrap items-center gap-2 rounded-lg bg-danger-50 px-3 py-1.5 text-sm text-danger-600">
                Delete this recording and its transcript for good?
                <Button size="sm" variant="danger" onClick={remove}>Yes, delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </span>
            )}
          </div>
        )}
        {editDetails && <DetailsEditor rec={recording} onSaved={(r) => { setRecording(r); setEditDetails(false); }} onClose={() => setEditDetails(false)} />}

        {jobActive && job && <div className="mt-6"><JobBanner job={job} workerMode={nlp?.transcription === false} /></div>}
        {job?.status === 'failed' && !jobActive && (
          <div className="mt-6"><Alert><span className="flex items-start gap-2"><HiOutlineExclamation className="w-5 h-5 shrink-0" />Transcription failed: {job.error || 'unknown error'}</span></Alert></div>
        )}
        {user && !jobActive && (segments.length === 0 || job?.status === 'failed') && (
          <div className="mt-5">
            <Button onClick={startTranscription} loading={starting} variant="ai" icon={<HiOutlineSparkles className="w-4 h-4" />}>
              {job?.status === 'failed' ? 'Try transcribing again' : 'Transcribe with AI'}
            </Button>
          </div>
        )}
      </Card>

      {recording.audio_url && (
        <div className="sticky top-16 z-30 -mx-4 mt-6 border-y border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-card sm:border sm:bg-surface/95 sm:shadow-card">
          <div className="flex items-center gap-3">
            <button
              onClick={player.toggle}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-saffron-600 text-white shadow-lift hover:bg-saffron-700"
              aria-label={player.playing ? 'Pause' : 'Play'}
            >
              {player.playing ? <HiOutlinePause className="w-6 h-6" /> : <HiOutlinePlay className="w-6 h-6 translate-x-px" />}
            </button>
            <div className="min-w-0 flex-1 pt-5">
              <Waveform
                player={player}
                peaks={peaks}
                activeId={activeId}
                regions={segments.map((s) => ({ id: s.id, start: s.start_ms, end: s.end_ms, verified: !!s.verified_at }))}
                height={56}
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-mono text-xs tabular text-ink-soft">{clock(player.time)} / {clock(player.duration || (recording.duration_seconds ?? 0) * 1000)}</span>
            <span className="flex items-center gap-1">
              <button onClick={() => player.seek(player.time - 5000)} className="rounded p-1 text-muted hover:bg-sunken" aria-label="Back 5 seconds"><HiOutlineRewind className="w-4 h-4" /></button>
              <button onClick={() => player.seek(player.time + 5000)} className="rounded p-1 text-muted hover:bg-sunken" aria-label="Forward 5 seconds"><HiOutlineFastForward className="w-4 h-4" /></button>
            </span>
            <span className="flex items-center gap-0.5" role="group" aria-label="Playback speed">
              {[0.75, 1, 1.25].map((r) => (
                <button key={r} onClick={() => player.setRate(r)} aria-pressed={player.rate === r}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${player.rate === r ? 'bg-ink text-white' : 'text-muted hover:bg-sunken'}`}>
                  {r}×
                </button>
              ))}
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-saffron-600" />
              Follow along
            </label>
            <span className="ml-auto hidden md:flex items-center gap-1.5 text-xs text-faint">
              <Kbd>Space</Kbd> play <Kbd>J</Kbd><Kbd>K</Kbd> next/prev <Kbd>E</Kbd> correct
            </span>
          </div>
        </div>
      )}

      <section className="mt-8" aria-labelledby="transcript-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="transcript-heading" className="text-xl font-bold text-ink">Transcript</h2>
            {counts.all > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-2 w-40 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                  <span className="bg-leaf-600" style={{ width: `${(counts.verified / counts.all) * 100}%` }} />
                  <span className="bg-saffron-500" style={{ width: `${(counts.corrected / counts.all) * 100}%` }} />
                </div>
                <span className="text-sm text-muted">{progress}% checked by people · {counts.verified} verified</span>
              </div>
            )}
          </div>
          {counts.all > 0 && (
            <div className="flex flex-wrap gap-1 rounded-lg bg-sunken p-1" role="tablist" aria-label="Filter passages">
              {filters.map((f) => (
                <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                  className={`rounded-md px-3 py-1 text-sm ${filter === f.key ? 'bg-surface font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {f.label} <span className="tabular text-faint">{f.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {segments.length === 0 ? (
          <EmptyState icon={<HiOutlineSparkles className="w-7 h-7" />} title={jobActive ? 'The transcript is on its way' : 'No transcript yet'}>
            {jobActive
              ? 'Passages appear here as soon as the AI finishes. You can leave this page; it keeps working.'
              : user ? 'Start AI transcription above. You’ll then correct the draft while listening.' : 'Sign in to start transcription.'}
          </EmptyState>
        ) : visible.length === 0 ? (
          <p className="rounded-xl bg-sunken px-4 py-6 text-center text-muted">No passages in this view.</p>
        ) : (
          <ol className="space-y-2.5">
            {visible.map((seg) => (
              <SegmentItem
                key={seg.id}
                ref={(el) => { if (el) itemRefs.current.set(seg.id, el); else itemRefs.current.delete(seg.id); }}
                seg={seg}
                active={seg.id === activeId}
                focused={seg.id === focusId}
                editing={seg.id === editingId}
                canEdit={canEdit}
                canVerify={canVerify}
                canTranslate={!!nlp?.translation}
                player={player}
                onEdit={() => { setEditingId(seg.id); setFocusId(seg.id); }}
                onCancel={() => setEditingId(null)}
                onSaved={onSaved}
              />
            ))}
          </ol>
        )}
        {!user && segments.length > 0 && (
          <p className="mt-6 text-center text-[15px] text-muted">
            Speak this dialect? <Link to="/login" state={{ from: `/recordings/${recording.id}` }} className="font-medium text-saffron-600">Sign in</Link> to correct the transcript.
          </p>
        )}
      </section>
    </div>
  );
}
