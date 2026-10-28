import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineSearch } from 'react-icons/hi';
import api from '../lib/api';
import { useNlpStatus } from '../lib/nlp';

interface Hit {
  segment_id: string;
  recording_id: string;
  recording_title: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  text?: string;
  score: number;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'keyword' | 'semantic'>('keyword');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nlp = useNlpStatus();

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'semantic' ? '/search/semantic' : '/search';
      const res = await api.get(endpoint, { params: { q: query } });
      setHits(res.data.hits);
      setSearched(true);
    } catch (err: any) {
      setHits([]);
      setSearched(false);
      setError(err.response?.data?.detail || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Search Archive</h1>

      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-stone-200 p-4 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recordings and transcriptions..."
              className="w-full pl-10 pr-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium cursor-pointer"
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
        <div className="flex gap-4 mt-3">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="radio"
              checked={mode === 'keyword'}
              onChange={() => setMode('keyword')}
              className="accent-amber-600"
            />
            Keyword Search
          </label>
          <label
            className={`flex items-center gap-2 text-sm ${nlp?.semantic_search === false ? 'text-stone-400' : 'text-stone-600 cursor-pointer'}`}
            title={nlp?.semantic_search === false ? 'Not set up on this server yet' : 'Finds passages with similar meaning, even in other words or languages'}
          >
            <input
              type="radio"
              checked={mode === 'semantic'}
              onChange={() => setMode('semantic')}
              disabled={nlp?.semantic_search === false}
              className="accent-amber-600"
            />
            Semantic Search (by meaning)
          </label>
        </div>
      </form>

      {error && <div className="p-3 mb-6 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

      {searched && (
        <div>
          <p className="text-sm text-stone-500 mb-4">{hits.length} result{hits.length !== 1 && 's'} found</p>

          {hits.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
              No results found. Try different keywords.
            </div>
          ) : (
            <div className="space-y-3">
              {hits.map((hit) => (
                <Link
                  key={hit.segment_id}
                  to={`/recordings/${hit.recording_id}`}
                  className="block bg-white rounded-xl border border-stone-200 p-4 hover:border-amber-300 hover:shadow-md transition-all no-underline"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-stone-800">{hit.recording_title}</h3>
                    <span className="text-xs font-mono text-stone-400">
                      {formatMs(hit.start_ms)} - {formatMs(hit.end_ms)}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600">{hit.text}</p>
                  <div className="text-xs text-stone-400 mt-2">
                    Segment #{hit.seq} &middot; Score: {hit.score.toFixed(3)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
