import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineGlobeAlt, HiOutlinePlus, HiOutlineArrowRight, HiOutlineSearch } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import type { Dialect } from '../lib/types';
import { Alert, Button, Card, EmptyState, Field, PageHeader } from '../components/ui';

// UNESCO's scale, from least to most endangered.
const endangerment: { value: string; className: string; level: number }[] = [
  { value: 'safe', className: 'bg-leaf-50 text-leaf-700', level: 0 },
  { value: 'vulnerable', className: 'bg-saffron-50 text-saffron-700', level: 1 },
  { value: 'definitely endangered', className: 'bg-saffron-100 text-saffron-700', level: 2 },
  { value: 'severely endangered', className: 'bg-danger-50 text-danger-600', level: 3 },
  { value: 'critically endangered', className: 'bg-danger-600 text-white', level: 4 },
];

// Whisper language codes. Most endangered dialects have no speech model of
// their own, so they're transcribed as the closest major language sharing the script.
const asrLanguages: Record<string, string> = {
  kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', hi: 'Hindi', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', ur: 'Urdu', ne: 'Nepali', as: 'Assamese',
  si: 'Sinhala', sa: 'Sanskrit', en: 'English',
};

const emptyForm = { name: '', iso_code: '', region: '', script: '', endangerment_status: '', description: '', asr_language: '' };

function LanguageSelect({ id, value, onChange }: { id?: string; value: string; onChange: (v: string) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">Detect automatically</option>
      {Object.entries(asrLanguages).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}

function DangerScale({ status }: { status?: string }) {
  const item = endangerment.find((e) => e.value === status);
  if (!item) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="flex gap-0.5" aria-hidden="true">
        {endangerment.map((e) => (
          <span key={e.value} className={`h-1.5 w-4 rounded-full ${e.level <= item.level ? (item.level >= 3 ? 'bg-danger-600' : 'bg-saffron-500') : 'bg-line'}`} />
        ))}
      </span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${item.className}`}>{item.value}</span>
    </div>
  );
}

export default function Dialects() {
  const { user } = useAuth();
  const toast = useToast();
  const { dialects, reload } = useDialects();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q
    ? dialects.filter((d) => [d.name, d.region, d.script, d.iso_code].some((v) => v?.toLowerCase().includes(q)))
    : dialects;
  const isVerifier = user?.role === 'verifier' || user?.role === 'admin';
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/dialects', Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim())));
      await reload();
      toast.success(`${form.name} added.`);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err, 'Could not add the dialect'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Dialect) => {
    try {
      await api.delete(`/dialects/${d.id}`);
      await reload();
      toast.success(`${d.name} removed.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove the dialect. Recordings may still use it.'));
    } finally {
      setConfirmDelete(null);
    }
  };

  const setLanguage = async (d: Dialect, asr_language: string) => {
    try {
      await api.patch(`/dialects/${d.id}`, { asr_language: asr_language || null });
      await reload();
      toast.success(`${d.name} will be transcribed as ${asrLanguages[asr_language] ?? 'detected automatically'}.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the dialect'));
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Dialects"
        title="Languages in the archive"
        subtitle="Each dialect lists where it’s spoken, its script, and how endangered it is on UNESCO’s scale."
        actions={user && !showForm && <Button onClick={() => setShowForm(true)} icon={<HiOutlinePlus className="w-5 h-5" />}>Add a dialect</Button>}
      />

      {showForm && (
        <Card className="mb-8 p-6 sm:p-8">
          <form onSubmit={create} className="space-y-5">
            <h2 className="text-xl font-semibold text-ink">New dialect</h2>
            {error && <Alert>{error}</Alert>}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="d-name"><input id="d-name" required autoFocus value={form.name} onChange={set('name')} className={input} placeholder="e.g. Tulu" /></Field>
              <Field label="ISO 639-3 code" htmlFor="d-iso" hint={<>Three letters, if it has one. <a href="https://iso639-3.sil.org/code_tables/639/data" target="_blank" rel="noreferrer" className="text-saffron-600">Look it up</a></>}>
                <input id="d-iso" value={form.iso_code} onChange={set('iso_code')} className={input} placeholder="e.g. tcy" maxLength={3} />
              </Field>
              <Field label="Where it’s spoken" htmlFor="d-region"><input id="d-region" value={form.region} onChange={set('region')} className={input} placeholder="e.g. Coastal Karnataka" /></Field>
              <Field label="Script" htmlFor="d-script"><input id="d-script" value={form.script} onChange={set('script')} className={input} placeholder="e.g. Kannada" /></Field>
              <Field label="How endangered (UNESCO)" htmlFor="d-danger">
                <select id="d-danger" value={form.endangerment_status} onChange={set('endangerment_status')} className={`${input} capitalize`}>
                  <option value="">Not known</option>
                  {endangerment.map((e) => <option key={e.value} value={e.value}>{e.value}</option>)}
                </select>
              </Field>
              <Field label="Transcribe as" htmlFor="d-asr" hint="The closest major language the AI knows, sharing the script.">
                <LanguageSelect id="d-asr" value={form.asr_language} onChange={(v) => setForm({ ...form, asr_language: v })} />
              </Field>
            </div>
            <Field label="About this dialect" htmlFor="d-desc">
              <textarea id="d-desc" rows={2} value={form.description} onChange={set('description')} className={`${input} resize-y`} />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={saving}>Add dialect</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {dialects.length > 8 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1 max-w-md">
            <HiOutlineSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find by name, state, script or ISO code"
              aria-label="Find a dialect"
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm focus:border-saffron-500 focus:outline-none"
            />
          </div>
          <p className="text-sm text-muted tabular">{q ? `${shown.length} of ${dialects.length}` : dialects.length} dialects</p>
        </div>
      )}

      {dialects.length > 0 && shown.length === 0 && (
        <p className="rounded-xl bg-sunken px-4 py-6 text-center text-muted">
          No dialect matches “{query}”.{user && ' Add it with “Add a dialect”.'}
        </p>
      )}

      {dialects.length === 0 ? (
        <EmptyState icon={<HiOutlineGlobeAlt className="w-7 h-7" />} title="No dialects yet">
          {user ? 'Add the first one: the dialect you speak, or the one you’re recording.' : 'Sign in to add the first dialect.'}
        </EmptyState>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((d) => (
            <Card key={d.id} as="article" className="flex flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-semibold text-ink">{d.name}</h3>
                {d.iso_code && <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-xs text-muted">{d.iso_code}</span>}
              </div>
              {(d.region || d.script) && (
                <p className="mt-1 text-sm text-muted">{[d.region, d.script && `${d.script} script`].filter(Boolean).join(' · ')}</p>
              )}
              <div className="mt-3"><DangerScale status={d.endangerment_status} /></div>
              {d.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{d.description}</p>}
              <div className="mt-auto pt-5 space-y-3">
                {isVerifier ? (
                  <Field label="Transcribe as" htmlFor={`asr-${d.id}`}>
                    <LanguageSelect id={`asr-${d.id}`} value={d.asr_language || ''} onChange={(v) => setLanguage(d, v)} />
                  </Field>
                ) : d.asr_language && (
                  <p className="text-xs text-faint">AI transcribes it as {asrLanguages[d.asr_language] ?? d.asr_language}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/recordings?dialect=${d.id}`} className="flex items-center gap-1 text-sm font-medium text-saffron-600 hover:text-saffron-700">
                    Recordings in {d.name} <HiOutlineArrowRight className="w-4 h-4" />
                  </Link>
                  {user?.role === 'admin' && (confirmDelete === d.id ? (
                    <span className="flex items-center gap-1 text-sm">
                      <Button size="sm" variant="danger" onClick={() => remove(d)}>Remove</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDelete(d.id)} className="text-sm text-faint hover:text-danger-600">Remove</button>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
