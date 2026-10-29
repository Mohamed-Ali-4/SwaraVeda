import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  HiOutlineMicrophone, HiOutlineUpload, HiOutlineStop, HiOutlineTrash, HiOutlineCheck,
  HiOutlineArrowLeft, HiOutlineArrowRight, HiOutlineSparkles, HiOutlineGlobe, HiOutlineChip,
} from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useDialects } from '../lib/dialects';
import { capitalize, clock } from '../lib/format';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import { genres } from '../lib/types';
import { Alert, Button, Card, Field, PageHeader } from '../components/ui';

const MAX_MB = 200;
const ageGroups = ['child', 'young adult', 'adult', 'elder'];

interface Source {
  blob: Blob;
  name: string;
  type: string;
  url: string;
  seconds: number | null;
  recorded: boolean;
}

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';
}

const extensionFor = (mime: string) => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

function mb(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

/** Microphone recording with a live input level. */
function useRecorder(onDone: (s: Source) => void, onError: (m: string) => void) {
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const cleanup = useRef<() => void>(() => {});

  const start = async () => {
    let stream: MediaStream;
    try {
      // Keep the voice natural: no echo cancellation or noise suppression.
      // Rumble and loudness are handled on the server before transcription.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch {
      onError('Microphone access was blocked. Allow it in your browser’s address bar, or upload a file instead.');
      return;
    }
    const mime = pickMime();
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'audio/webm';
      const blob = new Blob(chunks, { type });
      onDone({
        blob, type, url: URL.createObjectURL(blob), recorded: true,
        name: `recording-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${extensionFor(type)}`,
        seconds: Math.round((Date.now() - startedAt) / 1000),
      });
    };

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += v * v;
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      frame = requestAnimationFrame(tick);
    };
    tick();
    const timer = window.setInterval(() => setSeconds(Math.round((Date.now() - startedAt) / 1000)), 250);

    cleanup.current = () => {
      if (recorder.state !== 'inactive') recorder.stop();
      cancelAnimationFrame(frame);
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      setLevel(0);
    };
    recorder.start(1000);
    setSeconds(0);
    setActive(true);
  };

  const stop = () => {
    cleanup.current();
    cleanup.current = () => {};
    setActive(false);
  };

  useEffect(() => () => cleanup.current(), []);
  return { active, seconds, level, start, stop };
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex h-12 items-end justify-center gap-1" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => {
        const distance = Math.abs(i - 11.5) / 12;
        const h = Math.max(0.08, level * (1 - distance * 0.7) * (0.75 + ((i * 7) % 5) / 10));
        return <span key={i} className="w-1.5 rounded-full bg-danger-600/80 transition-[height] duration-75" style={{ height: `${Math.min(100, h * 100)}%` }} />;
      })}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const names = ['Audio', 'About the recording', 'Consent & upload'];
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Progress">
      {names.map((name, i) => (
        <li key={name} className="flex flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
          <span className={`h-1.5 rounded-full ${i <= step ? 'bg-saffron-500' : 'bg-line'}`} />
          <span className={`text-sm ${i === step ? 'font-semibold text-ink' : i < step ? 'text-saffron-700' : 'text-faint'}`}>
            <span className="hidden sm:inline">{i + 1}. </span>{name}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ConsentOption({ checked, onChange, icon, title, children }: {
  checked: boolean; onChange: (v: boolean) => void; icon: ReactNode; title: string; children: ReactNode;
}) {
  return (
    <label className={`flex cursor-pointer gap-4 rounded-xl border p-4 transition ${
      checked ? 'border-saffron-500 bg-saffron-50' : 'border-line-strong bg-surface hover:border-saffron-300'
    }`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-saffron-600" />
      <span>
        <span className="flex items-center gap-2 font-semibold text-ink">{icon}{title}</span>
        <span className="mt-1 block text-sm text-muted">{children}</span>
      </span>
    </label>
  );
}

export default function NewRecording() {
  const navigate = useNavigate();
  const toast = useToast();
  const { dialects } = useDialects();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', dialect_id: params.get('dialect') ?? '', genre: '', speaker_name: '', speaker_age_group: '',
    recorded_place: '', recorded_at: '', notes: '',
  });
  const [consentPublic, setConsentPublic] = useState(false);
  const [consentAi, setConsentAi] = useState(false);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const recorder = useRecorder(
    (s) => { setSource(s); setError(''); },
    (m) => setError(m),
  );

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  const chooseFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
      setError('That file isn’t audio or video. Try an MP3, M4A, WAV, OGG, WebM or a phone video.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is ${mb(file.size)}. Files up to ${MAX_MB} MB work; split longer sessions into parts.`);
      return;
    }
    setError('');
    const url = URL.createObjectURL(file);
    const s: Source = { blob: file, name: file.name, type: file.type, url, seconds: null, recorded: false };
    setSource(s);
    if (!form.title) setForm((f) => ({ ...f, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }));
    const probe = new Audio(url);
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setSource((cur) => (cur?.url === url ? { ...cur, seconds: Math.round(probe.duration) } : cur));
    };
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0]);
  };

  const next = (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    if (step === 0 && !source) return setError('Record or choose an audio file first.');
    if (step === 1 && !form.title.trim()) return setError('Give the recording a title.');
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const upload = async () => {
    if (!source) return;
    setError('');
    setProgress(0);
    try {
      setStage('Preparing upload…');
      const { data } = await api.post('/recordings/upload-url', { filename: source.name, content_type: source.type });
      setStage('Uploading audio…');
      await axios.put(data.upload_url, source.blob, {
        headers: { 'Content-Type': source.type || 'application/octet-stream', 'x-upsert': 'true' },
        onUploadProgress: (ev) => setProgress(ev.total ? ev.loaded / ev.total : null),
      });
      setStage('Saving details…');
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
      const rec = (await api.post('/recordings', {
        ...body,
        storage_path: data.storage_path,
        duration_seconds: source.seconds ?? undefined,
        consent_public: consentPublic,
        consent_ai_training: consentAi,
      })).data;
      if (autoTranscribe) {
        await api.post(`/recordings/${rec.id}/transcribe`).catch(() =>
          toast.error('Saved, but transcription didn’t start. Use “Transcribe” on the recording page.'));
      }
      toast.success(autoTranscribe ? 'Uploaded. Transcription has started.' : 'Recording uploaded.');
      navigate(`/recordings/${rec.id}`);
    } catch (err) {
      setError(errorMessage(err, 'Upload failed'));
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  const setField = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="New recording"
        title="Add a voice to the archive"
        subtitle="Three short steps. You can edit the details later."
      />
      <Stepper step={step} />
      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      {step === 0 && (
        <Card className="p-6 sm:p-8">
          {!source ? (
            recorder.active ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="mb-1 flex items-center gap-2 text-sm font-medium text-danger-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger-600" /> Recording
                </span>
                <p className="font-display text-5xl font-bold tabular text-ink">{clock(recorder.seconds * 1000)}</p>
                <div className="my-6 w-full max-w-xs"><LevelMeter level={recorder.level} /></div>
                <p className="mb-6 text-sm text-muted">
                  {recorder.level < 0.04 ? 'We can’t hear much. Move closer to the speaker.' : 'Sounding good.'}
                </p>
                <Button variant="danger" size="lg" onClick={recorder.stop} icon={<HiOutlineStop className="w-5 h-5" />}>
                  Stop recording
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={recorder.start}
                  className="group flex flex-col items-center rounded-xl border border-line-strong bg-surface px-6 py-8 text-center transition hover:border-saffron-500 hover:bg-saffron-50"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-saffron-600 text-white shadow-lift transition group-hover:scale-105">
                    <HiOutlineMicrophone className="w-8 h-8" />
                  </span>
                  <span className="mt-4 font-semibold text-ink">Record now</span>
                  <span className="mt-1 text-sm text-muted">Use this device’s microphone</span>
                </button>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
                  role="button"
                  tabIndex={0}
                  className={`flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                    dragging ? 'border-saffron-500 bg-saffron-50' : 'border-line-strong hover:border-saffron-300'
                  }`}
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sunken text-ink-soft">
                    <HiOutlineUpload className="w-8 h-8" />
                  </span>
                  <span className="mt-4 font-semibold text-ink">Upload a file</span>
                  <span className="mt-1 text-sm text-muted">Drop it here or click. Audio or phone video, up to {MAX_MB} MB.</span>
                  <input ref={fileInput} type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0])} />
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-50 text-leaf-600"><HiOutlineCheck className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{source.recorded ? 'Recording ready' : source.name}</p>
                  <p className="text-sm text-muted tabular">
                    {source.seconds ? clock(source.seconds * 1000) : 'Length unknown'} · {mb(source.blob.size)}
                  </p>
                </div>
              </div>
              <audio src={source.url} controls className="w-full" />
              <Button variant="ghost" size="sm" onClick={() => setSource(null)} icon={<HiOutlineTrash className="w-4 h-4" />}>
                Use a different recording
              </Button>
            </div>
          )}
          <div className="mt-8 flex justify-end">
            <Button onClick={() => next()} disabled={!source} icon={<HiOutlineArrowRight className="w-4 h-4" />} className="flex-row-reverse">
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-6 sm:p-8">
          <form onSubmit={next} className="space-y-5">
            <Field label="Title" htmlFor="rec-title" hint="What would someone search for? e.g. “Harvest song by Kamala, Mangaluru”.">
              <input id="rec-title" value={form.title} onChange={setField('title')} required autoFocus className={input} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Dialect" htmlFor="rec-dialect" hint={<>Missing? <Link to="/dialects/list" target="_blank" className="text-saffron-600">Add a dialect</Link>, then reload.</>}>
                <select id="rec-dialect" value={form.dialect_id} onChange={setField('dialect_id')} className={input}>
                  <option value="">Not sure</option>
                  {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Speaker" htmlFor="rec-speaker" hint="Their name, or how they want to be credited.">
                <input id="rec-speaker" value={form.speaker_name} onChange={setField('speaker_name')} className={input} />
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-soft">What kind of recording is it?</legend>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <button
                    type="button" key={g}
                    onClick={() => setForm({ ...form, genre: form.genre === g ? '' : g })}
                    aria-pressed={form.genre === g}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                      form.genre === g ? 'border-saffron-600 bg-saffron-600 text-white' : 'border-line-strong bg-surface text-ink-soft hover:border-saffron-300'
                    }`}
                  >
                    {capitalize(g)}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Speaker’s age" htmlFor="rec-age">
                <select id="rec-age" value={form.speaker_age_group} onChange={setField('speaker_age_group')} className={input}>
                  <option value="">Not given</option>
                  {ageGroups.map((a) => <option key={a} value={a}>{capitalize(a)}</option>)}
                </select>
              </Field>
              <Field label="Where" htmlFor="rec-place">
                <input id="rec-place" value={form.recorded_place} onChange={setField('recorded_place')} className={input} placeholder="Village, town" />
              </Field>
              <Field label="When" htmlFor="rec-date">
                <input id="rec-date" type="date" value={form.recorded_at} onChange={setField('recorded_at')} className={input} max={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>
            <Field label="Notes" htmlFor="rec-notes" hint="Context that helps listeners: the occasion, the story behind the song.">
              <textarea id="rec-notes" rows={3} value={form.notes} onChange={setField('notes')} className={`${input} resize-y`} />
            </Field>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(0)} icon={<HiOutlineArrowLeft className="w-4 h-4" />}>Back</Button>
              <Button type="submit" icon={<HiOutlineArrowRight className="w-4 h-4" />} className="flex-row-reverse">Continue</Button>
            </div>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">Ask the speaker</h2>
            <p className="mt-1 text-[15px] text-muted">
              Tick only what they agreed to. These are separate choices, and you can change them later on the recording page.
            </p>
          </div>
          <div className="space-y-3">
            <ConsentOption checked={consentPublic} onChange={setConsentPublic} icon={<HiOutlineGlobe className="w-5 h-5 text-saffron-600" />} title="Anyone may listen">
              The recording and its transcript are public in the archive and appear in search.
              If unticked, only you, verifiers and admins can see it.
            </ConsentOption>
            <ConsentOption checked={consentAi} onChange={setConsentAi} icon={<HiOutlineChip className="w-5 h-5 text-lotus-500" />} title="May help train speech AI">
              Corrected transcripts may be included in datasets that teach speech recognition to understand this dialect.
            </ConsentOption>
          </div>
          <label className="flex items-center gap-3 rounded-xl bg-lotus-50 p-4 text-[15px] text-ink cursor-pointer">
            <input type="checkbox" checked={autoTranscribe} onChange={(e) => setAutoTranscribe(e.target.checked)} className="h-5 w-5 accent-lotus-600" />
            <HiOutlineSparkles className="w-5 h-5 text-lotus-500 shrink-0" />
            Start AI transcription straight after uploading
          </label>
          <p className="text-sm text-muted">Shared under CC BY-NC 4.0: others may reuse it non-commercially with credit.</p>

          {uploading && (
            <div aria-live="polite">
              <div className="mb-1.5 flex justify-between text-sm text-ink-soft">
                <span>{stage}</span>
                {progress !== null && <span className="tabular">{Math.round(progress * 100)}%</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-saffron-500 transition-all" style={{ width: `${Math.max(3, (progress ?? 0) * 100)}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={uploading} icon={<HiOutlineArrowLeft className="w-4 h-4" />}>Back</Button>
            <Button size="lg" onClick={upload} loading={uploading} icon={<HiOutlineUpload className="w-5 h-5" />}>
              {uploading ? 'Uploading…' : 'Upload recording'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
