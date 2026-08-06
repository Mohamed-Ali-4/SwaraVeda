import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineMicrophone, HiOutlineClock, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';
import api from '../lib/api';

interface Recording {
  id: string;
  title: string;
  status: string;
  genre?: string;
  duration_seconds?: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  uploaded: 'bg-stone-100 text-stone-600',
  transcribing: 'bg-yellow-100 text-yellow-700',
  transcribed: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
};

export default function Recordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 12;

  useEffect(() => {
    setLoading(true);
    api.get('/recordings', { params: { page, page_size: pageSize } })
      .then((res) => {
        setRecordings(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Recordings</h1>
        <Link
          to="/recordings/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 no-underline text-sm font-medium transition-colors"
        >
          <HiOutlineMicrophone className="w-5 h-5" />
          New Recording
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <div className="text-5xl mb-4">🎙️</div>
          <h3 className="text-lg font-medium text-stone-700">No recordings yet</h3>
          <p className="text-stone-500 mt-1">Be the first to contribute!</p>
          <Link to="/recordings/new" className="inline-block mt-4 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 no-underline text-sm">
            Upload Recording
          </Link>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((rec) => (
              <Link
                key={rec.id}
                to={`/recordings/${rec.id}`}
                className="bg-white rounded-xl border border-stone-200 p-5 hover:border-amber-300 hover:shadow-md transition-all no-underline"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-stone-800 line-clamp-1">{rec.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[rec.status] || 'bg-stone-100 text-stone-600'}`}>
                    {rec.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-stone-500">
                  {rec.genre && <span className="capitalize">{rec.genre}</span>}
                  {rec.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <HiOutlineClock className="w-4 h-4" />
                      {Math.floor(rec.duration_seconds / 60)}:{String(Math.floor(rec.duration_seconds % 60)).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-400 mt-2">
                  {new Date(rec.created_at).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
              >
                <HiOutlineChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-stone-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
              >
                <HiOutlineChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
