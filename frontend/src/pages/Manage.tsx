import { useEffect, useState, type FormEvent } from 'react';
import { genres } from '../lib/types';
import { capitalize } from '../lib/format';
import { HiOutlineDownload, HiOutlineUserGroup, HiOutlineDatabase, HiOutlineLink } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDialects } from '../lib/dialects';
import { date, initials } from '../lib/format';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import { Button, Card, EmptyState, Field, PageHeader } from '../components/ui';

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  native_dialect?: string;
  created_at: string;
}

const roles = [
  { value: 'contributor', help: 'Records and corrects' },
  { value: 'verifier', help: 'Also approves and exports' },
  { value: 'admin', help: 'Also manages people' },
];

function DatasetExport() {
  const toast = useToast();
  const { dialects } = useDialects();
  const [dialectId, setDialectId] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [format, setFormat] = useState<'jsonl' | 'csv'>('jsonl');
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/export/segments', {
        params: { format, verified_only: verifiedOnly, dialect_id: dialectId || undefined },
        responseType: 'blob',
      });
      const name = /filename="(.+)"/.exec(res.headers['content-disposition'] || '')?.[1] || `swaraveda-dataset.${format}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${name}.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lotus-50 text-lotus-600"><HiOutlineDatabase className="w-6 h-6" /></span>
        <div>
          <h2 className="text-xl font-semibold text-ink">Training dataset</h2>
          <p className="mt-1 max-w-2xl text-[15px] text-muted">
            Every human-corrected passage beside what the AI first heard, with its audio link and timestamps:
            the material for teaching speech recognition this dialect. Only recordings whose speakers agreed to AI training are included.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Field label="Dialect" htmlFor="ex-dialect">
          <select id="ex-dialect" value={dialectId} onChange={(e) => setDialectId(e.target.value)} className={input}>
            <option value="">All dialects</option>
            {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Format" htmlFor="ex-format">
          <select id="ex-format" value={format} onChange={(e) => setFormat(e.target.value as 'jsonl' | 'csv')} className={input}>
            <option value="jsonl">JSON Lines, for ML tools</option>
            <option value="csv">CSV, for spreadsheets</option>
          </select>
        </Field>
        <label className="flex items-center gap-2.5 self-end pb-3 text-[15px] text-ink-soft cursor-pointer">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-5 w-5 accent-saffron-600" />
          Verified passages only
        </label>
      </div>
      <Button className="mt-5" onClick={download} loading={downloading} icon={<HiOutlineDownload className="w-5 h-5" />}>
        {downloading ? 'Preparing…' : 'Download dataset'}
      </Button>
    </Card>
  );
}

function Users({ currentUserId }: { currentUserId: string }) {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  useEffect(() => {
    api.get('/admin/users').then((res) => setUsers(res.data)).catch(() => setUsers([]));
  }, []);

  const setRole = async (u: AdminUser, role: string) => {
    try {
      const res = await api.patch(`/admin/users/${u.id}`, { role });
      setUsers((prev) => prev && prev.map((x) => (x.id === u.id ? res.data : x)));
      toast.success(`${u.display_name} is now ${role === 'admin' ? 'an' : 'a'} ${role}.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change role'));
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saffron-50 text-saffron-600"><HiOutlineUserGroup className="w-6 h-6" /></span>
        <div>
          <h2 className="text-xl font-semibold text-ink">People</h2>
          <p className="mt-1 text-[15px] text-muted">Make trusted native speakers verifiers so they can approve corrections.</p>
        </div>
      </div>
      {users && users.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<HiOutlineUserGroup className="w-7 h-7" />} title="No one else has joined yet" /></div>
      ) : (
        <ul className="mt-6 divide-y divide-line">
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lotus-50 text-sm font-semibold text-lotus-600">{initials(u.display_name)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">{u.display_name}{u.id === currentUserId && <span className="ml-2 text-xs text-faint">(you)</span>}</p>
                <p className="text-sm text-muted truncate">{u.email}{u.native_dialect && ` · speaks ${u.native_dialect}`} · joined {date(u.created_at)}</p>
              </div>
              <select value={u.role} onChange={(e) => setRole(u, e.target.value)} disabled={u.id === currentUserId}
                aria-label={`Role for ${u.display_name}`}
                className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm capitalize disabled:bg-sunken disabled:text-muted">
                {roles.map((r) => <option key={r.value} value={r.value}>{r.value}: {r.help}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


const LICENCES = [
  'Public domain', 'CC0 1.0', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'Used with the owner\u2019s permission',
];
// Licences that allow the clip to be used for training speech AI.
const TRAINABLE = new Set(['Public domain', 'CC0 1.0', 'CC BY 4.0', 'CC BY-SA 4.0']);

/** Add an existing, openly licensed folk recording so listeners can hear the dialect. */
function ReferenceRecording() {
  const { dialects } = useDialects();
  const toast = useToast();
  const empty = { title: '', dialect_id: '', audio_url: '', speaker_name: '', genre: 'song', licence: 'CC BY 4.0', source: '', source_url: '' };
  const [form, setForm] = useState(empty);
  const [transcribe, setTranscribe] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  interface Found { title: string; audio_url: string; page_url?: string; licence: string; open_licence: boolean; author: string; description: string; word?: string | null; already_added: boolean }
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const search = async () => {
    if (!form.dialect_id) return toast.error('Choose a dialect first.');
    setSearching(true);
    setFound(null);
    try {
      setFound((await api.get('/references/commons', { params: { dialect_id: form.dialect_id } })).data.results);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not search Wikimedia Commons'));
    } finally {
      setSearching(false);
    }
  };
  const addFound = async (f: Found) => {
    try {
      await api.post('/recordings', {
        title: f.word ? `\u201c${f.word}\u201d \u2014 spoken word` : f.title,
        dialect_id: form.dialect_id,
        audio_url: f.audio_url,
        speaker_name: f.author || undefined,
        genre: f.word ? 'other' : 'song',
        licence: f.licence,
        consent_public: true,
        consent_ai_training: TRAINABLE.has(f.licence) || /^(cc by|cc0|public domain)/i.test(f.licence) && !/nc|nd/i.test(f.licence),
        notes: `Reference recording. Source: Wikimedia Commons${f.author ? `, by ${f.author}` : ''}${f.page_url ? ` (${f.page_url})` : ''}. Licence: ${f.licence}.${f.description ? ` ${f.description}` : ''}`,
      });
      setFound((list) => list && list.map((x) => (x.audio_url === f.audio_url ? { ...x, already_added: true } : x)));
      toast.success('Added. It now plays on the dialect\u2019s tape.');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the recording'));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const rec = (await api.post('/recordings', {
        title: form.title.trim(),
        dialect_id: form.dialect_id || undefined,
        audio_url: form.audio_url.trim(),
        speaker_name: form.speaker_name.trim() || undefined,
        genre: form.genre,
        licence: form.licence,
        consent_public: true,
        consent_ai_training: TRAINABLE.has(form.licence),
        notes: `Reference recording. Source: ${form.source.trim()}${form.source_url.trim() ? ` (${form.source_url.trim()})` : ''}. Licence: ${form.licence}.`,
      })).data;
      if (transcribe) await api.post(`/recordings/${rec.id}/transcribe`).catch(() => {});
      toast.success('Reference recording added. It now plays on the dialect\u2019s tape.');
      setForm({ ...empty, dialect_id: form.dialect_id, licence: form.licence });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the recording'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-saffron-600 text-saffron-600"><HiOutlineLink className="w-5 h-5" /></span>
        <div>
          <h2 className="text-xl font-semibold text-ink">Add a reference recording</h2>
          <p className="mt-1 max-w-2xl text-[15px] text-muted">
            Bring in an existing folk song or story so people can hear a dialect before anyone records it here.
            Use only recordings you are allowed to share: public domain, Creative Commons, or with the owner&rsquo;s permission.
            Paste a direct link to the audio file (ending in .mp3, .ogg, .wav or .m4a), e.g. from Wikimedia Commons or the Internet Archive.
          </p>
        </div>
      </div>
      <div className="mt-6 border border-line bg-paper/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Field label="Find on Wikimedia Commons" htmlFor="ref-find">
              <select id="ref-find" value={form.dialect_id} onChange={set('dialect_id')} className={input}>
                <option value="">Choose a dialect</option>
                {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </div>
          <Button type="button" variant="secondary" loading={searching} onClick={search}>Search</Button>
        </div>
        <p className="mt-2 text-[13px] text-muted">Finds audio of this dialect on Wikimedia Commons, including words spoken by native speakers on Lingua Libre. Listen first; add only what is really this dialect.</p>
        {found && (found.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nothing on Commons for this dialect yet. Try another name, or add a link below.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {found.map((f) => (
              <li key={f.audio_url} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{f.word ? `\u201c${f.word}\u201d (spoken word)` : f.title}</p>
                  <p className="truncate text-[13px] text-muted">
                    {f.author || 'Unknown author'} · <span className={f.open_licence ? 'text-leaf-700' : 'text-danger-600'}>{f.licence || 'No licence'}</span>
                    {f.page_url && <> · <a href={f.page_url} target="_blank" rel="noreferrer" className="text-saffron-600">source ↗</a></>}
                  </p>
                  <audio controls preload="none" src={f.audio_url} className="mt-2 h-8 w-full max-w-sm" />
                </div>
                <Button type="button" size="sm" variant={f.already_added ? 'ghost' : 'primary'} disabled={f.already_added || !f.open_licence}
                  title={f.open_licence ? '' : 'Not openly licensed, so it can\u2019t be copied into the archive'} onClick={() => addFound(f)}>
                  {f.already_added ? 'Added' : f.open_licence ? 'Add' : 'Not open licence'}
                </Button>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <p className="lbl mt-6 text-muted">Or add any open recording by its link</p>
      <form onSubmit={submit} className="mt-3 grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="ref-title"><input id="ref-title" required value={form.title} onChange={set('title')} className={input} placeholder="e.g. Koti Chennaya paddana" /></Field>
        <Field label="Dialect" htmlFor="ref-dialect">
          <select id="ref-dialect" required value={form.dialect_id} onChange={set('dialect_id')} className={input}>
            <option value="">Choose a dialect</option>
            {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Link to the audio file" htmlFor="ref-url" hint="The direct file, not the page it is on. Right-click the player or download link and copy the address.">
            <input id="ref-url" required type="url" pattern="https?://.+" value={form.audio_url} onChange={set('audio_url')} className={input} placeholder="https://upload.wikimedia.org/…/song.ogg" />
          </Field>
        </div>
        <Field label="Singer or speaker" htmlFor="ref-speaker"><input id="ref-speaker" value={form.speaker_name} onChange={set('speaker_name')} className={input} /></Field>
        <Field label="Kind" htmlFor="ref-genre">
          <select id="ref-genre" value={form.genre} onChange={set('genre')} className={input}>
            {genres.map((g) => <option key={g} value={g}>{capitalize(g)}</option>)}
          </select>
        </Field>
        <Field label="Licence" htmlFor="ref-licence" hint={TRAINABLE.has(form.licence) ? 'This licence allows use for training Vani.' : 'Kept out of Vani\u2019s training data.'}>
          <select id="ref-licence" value={form.licence} onChange={set('licence')} className={input}>
            {LICENCES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </Field>
        <Field label="Source (credit)" htmlFor="ref-source"><input id="ref-source" required value={form.source} onChange={set('source')} className={input} placeholder="e.g. Wikimedia Commons, uploaded by …" /></Field>
        <div className="sm:col-span-2">
          <Field label="Source page (optional)" htmlFor="ref-source-url"><input id="ref-source-url" type="url" value={form.source_url} onChange={set('source_url')} className={input} placeholder="https://commons.wikimedia.org/wiki/File:…" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
          <input type="checkbox" checked={transcribe} onChange={(e) => setTranscribe(e.target.checked)} /> Let Vani transcribe it
        </label>
        <div className="sm:col-span-2"><Button type="submit" loading={saving} icon={<HiOutlineLink className="w-4 h-4" />}>Add recording</Button></div>
      </form>
    </Card>
  );
}

export default function Manage() {
  const { user } = useAuth();
  if (!user || (user.role !== 'verifier' && user.role !== 'admin')) {
    return <EmptyState icon={<HiOutlineUserGroup className="w-7 h-7" />} title="For verifiers and admins">Ask an admin to make you a verifier.</EmptyState>;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Manage" title="Archive tools" subtitle="Add reference recordings, export the dataset and decide who can approve transcripts." />
      <ReferenceRecording />
      <DatasetExport />
      {user.role === 'admin' && <Users currentUserId={user.id} />}
    </div>
  );
}
