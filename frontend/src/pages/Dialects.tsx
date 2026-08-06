import { useEffect, useState } from 'react';
import { HiOutlineGlobeAlt } from 'react-icons/hi';
import api from '../lib/api';

interface Dialect {
  id: string;
  name: string;
  iso_code?: string;
  region?: string;
  script?: string;
  endangerment_status?: string;
  description?: string;
}

const dangerColors: Record<string, string> = {
  safe: 'bg-green-100 text-green-700',
  vulnerable: 'bg-yellow-100 text-yellow-700',
  'definitely endangered': 'bg-orange-100 text-orange-700',
  'severely endangered': 'bg-red-100 text-red-700',
  'critically endangered': 'bg-red-200 text-red-800',
};

export default function Dialects() {
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dialects')
      .then((res) => setDialects(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Dialects</h1>

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
