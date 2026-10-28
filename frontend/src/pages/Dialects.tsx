import { useEffect, useState, type FormEvent } from 'react';
import { HiOutlineGlobeAlt, HiOutlinePlus } from 'react-icons/hi';
import api from '../lib/api';
import { useAuth } from '../lib/auth';

interface Dialect {
  id: string;
  name: string;
  iso_code?: string;
  region?: string;
  script?: string;
  endangerment_status?: string;
  description?: string;
  asr_language?: string;
}

const dangerColors: Record<string, string> = {
  safe: 'bg-green-100 text-green-700',
  vulnerable: 'bg-yellow-100 text-yellow-700',
  'definitely endangered': 'bg-orange-100 text-orange-700',
  'severely endangered': 'bg-red-100 text-red-700',
  'critically endangered': 'bg-red-200 text-red-800',
};

const endangerment = Object.keys(dangerColors);

// Whisper language codes. Most endangered dialects have no Whisper model of
// their own, so transcribe with the closest major language that shares the script.
const asrLanguages: Record<string, string> = {
  kn: 'Kannada', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', hi: 'Hindi', mr: 'Marathi',
  bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', ur: 'Urdu', ne: 'Nepali', as: 'Assamese',
  si: 'Sinhala', sa: 'Sanskrit', en: 'English',
};

const emptyForm = {
  name: '', iso_code: '', region: '', script: '', endangerment_status: '', description: '', asr_language: '',
};

const inputClass =
  'w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';

function LanguageSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">Auto-detect</option>
      {Object.entries(asrLanguages).map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  );
}

export default function Dialects() {
  const { user } = useAuth();
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isVerifier = user?.role === 'verifier' || user?.role === 'admin';

  useEffect(() => {
    api.get('/dialects')
      .then((res) => setDialects(res.data))
      .finally(() => setLoading(false));
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    // Send only filled-in fields; empty strings would fail enum validation.
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    try {
      const res = await api.post('/dialects', body);
      setDialects((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(emptyForm);
      setShowForm(false);
    } catch (err: any) {
      setError(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || 'Could not add dialect');
    } finally {
      setSaving(false);
    }
  };

  const setLanguage = async (d: Dialect, asr_language: string) => {
    try {
      const res = await api.patch(`/dialects/${d.id}`, { asr_language: asr_language || null });
      setDialects((prev) => prev.map((x) => (x.id === d.id ? res.data : x)));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not update dialect');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Dialects</h1>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 cursor-pointer"
          >
            <HiOutlinePlus className="w-4 h-4" />
            Add Dialect
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-stone-800">New dialect</h2>
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-stone-500">
              Name *
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} placeholder="e.g. Tulu" />
            </label>
            <label className="text-xs font-medium text-stone-500">
              ISO 639-3 code
              <input value={form.iso_code} onChange={(e) => setForm({ ...form, iso_code: e.target.value })} className={inputClass} placeholder="e.g. tcy" />
            </label>
            <label className="text-xs font-medium text-stone-500">
              Region
              <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className={inputClass} placeholder="e.g. Coastal Karnataka" />
            </label>
            <label className="text-xs font-medium text-stone-500">
              Script
              <input value={form.script} onChange={(e) => setForm({ ...form, script: e.target.value })} className={inputClass} placeholder="e.g. Kannada" />
            </label>
            <label className="text-xs font-medium text-stone-500">
              Endangerment (UNESCO)
              <select value={form.endangerment_status} onChange={(e) => setForm({ ...form, endangerment_status: e.target.value })} className={inputClass}>
                <option value="">Unknown</option>
                {endangerment.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-stone-500">
              Transcribe as
              <LanguageSelect value={form.asr_language} onChange={(v) => setForm({ ...form, asr_language: v })} />
            </label>
          </div>
          <label className="text-xs font-medium text-stone-500 block">
            Description
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputClass} resize-none`} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer">
              {saving ? 'Saving...' : 'Add Dialect'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
              Cancel
            </button>
          </div>
        </form>
      )}

      {dialects.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          <HiOutlineGlobeAlt className="w-12 h-12 mx-auto mb-3 text-stone-300" />
          <p>No dialects registered yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dialects.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-stone-800">{d.name}</h3>
                {d.iso_code && (
                  <span className="text-xs font-mono px-2 py-0.5 bg-stone-100 text-stone-500 rounded">
                    {d.iso_code}
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-sm text-stone-500">
                {d.region && <p>Region: {d.region}</p>}
                {d.script && <p>Script: {d.script}</p>}
                {d.endangerment_status && (
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${dangerColors[d.endangerment_status] || 'bg-stone-100 text-stone-600'}`}>
                    {d.endangerment_status}
                  </span>
                )}
                {d.description && <p className="text-stone-400 mt-2">{d.description}</p>}
                {isVerifier ? (
                  <label className="block text-xs text-stone-400 pt-2">
                    Transcribe as
                    <LanguageSelect value={d.asr_language || ''} onChange={(v) => setLanguage(d, v)} />
                  </label>
                ) : (
                  d.asr_language && (
                    <p className="text-xs text-stone-400">Transcribed as {asrLanguages[d.asr_language] || d.asr_language}</p>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
