import { useEffect, useState } from 'react';
import { HiOutlineDownload, HiOutlineUserGroup, HiOutlineDatabase } from 'react-icons/hi';
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

export default function Manage() {
  const { user } = useAuth();
  if (!user || (user.role !== 'verifier' && user.role !== 'admin')) {
    return <EmptyState icon={<HiOutlineUserGroup className="w-7 h-7" />} title="For verifiers and admins">Ask an admin to make you a verifier.</EmptyState>;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Manage" title="Archive tools" subtitle="Export the dataset and decide who can approve transcripts." />
      <DatasetExport />
      {user.role === 'admin' && <Users currentUserId={user.id} />}
    </div>
  );
}
