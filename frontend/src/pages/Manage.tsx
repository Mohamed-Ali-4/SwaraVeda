import { useEffect, useState } from 'react';
import { HiOutlineDownload, HiOutlineUserGroup } from 'react-icons/hi';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface AdminUser {
  id: string;
  display_name: string;
  email: string;
  role: string;
  native_dialect?: string;
  created_at: string;
}

interface Dialect {
  id: string;
  name: string;
}

const roles = ['contributor', 'verifier', 'admin'];

function DatasetExport() {
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [dialectId, setDialectId] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [format, setFormat] = useState<'jsonl' | 'csv'>('jsonl');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/dialects').then((res) => setDialects(res.data));
  }, []);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/export/segments', {
        params: { format, verified_only: verifiedOnly, dialect_id: dialectId || undefined },
        responseType: 'blob',
      });
      const name = /filename="(.+)"/.exec(res.headers['content-disposition'] || '')?.[1]
        || `swaraveda-dataset.${format}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-6">
      <h2 className="text-lg font-semibold text-stone-800 flex items-center gap-2 mb-1">
        <HiOutlineDownload className="w-5 h-5" />
        Export training dataset
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        Human-corrected segments paired with the machine transcript, with audio links and timestamps,
        for fine-tuning speech models. Only recordings whose speakers consented to AI training are included.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <label className="text-xs font-medium text-stone-500">
          Dialect
          <select value={dialectId} onChange={(e) => setDialectId(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
            <option value="">All dialects</option>
            {dialects.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-500">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value as 'jsonl' | 'csv')} className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm">
            <option value="jsonl">JSON Lines (for ML tools)</option>
            <option value="csv">CSV (for spreadsheets)</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm text-stone-600 pb-2 cursor-pointer">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="accent-amber-600" />
          Verified segments only
        </label>
      </div>
      <button
        onClick={download}
        disabled={downloading}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
      >
        {downloading ? 'Preparing...' : 'Download'}
      </button>
    </section>
  );
}

function Users({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    api.get('/admin/users').then((res) => setUsers(res.data));
  }, []);

  const setRole = async (u: AdminUser, role: string) => {
    try {
      const res = await api.patch(`/admin/users/${u.id}`, { role });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not change role');
    }
  };

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-6">
      <h2 className="text-lg font-semibold text-stone-800 flex items-center gap-2 mb-1">
        <HiOutlineUserGroup className="w-5 h-5" />
        Users
      </h2>
      <p className="text-sm text-stone-500 mb-4">
        Verifiers can approve corrected transcripts and export the dataset. Admins can also manage users.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-200">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Joined</th>
              <th className="py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-stone-100">
                <td className="py-2 pr-4 text-stone-800">{u.display_name}</td>
                <td className="py-2 pr-4 text-stone-500">{u.email}</td>
                <td className="py-2 pr-4 text-stone-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u, e.target.value)}
                    disabled={u.id === currentUserId}
                    className="px-2 py-1 border border-stone-300 rounded-lg text-sm disabled:bg-stone-50"
                  >
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Manage() {
  const { user } = useAuth();
  if (!user || (user.role !== 'verifier' && user.role !== 'admin')) {
    return <div className="text-center py-12 text-stone-500">This page is for verifiers and admins.</div>;
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Manage</h1>
      <DatasetExport />
      {user.role === 'admin' && <Users currentUserId={user.id} />}
    </div>
  );
}
