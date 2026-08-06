import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HiOutlineMicrophone, HiOutlineCheckCircle, HiOutlineChatAlt2, HiOutlineGlobeAlt, HiOutlineUsers, HiOutlineClock } from 'react-icons/hi';
import api from '../lib/api';

interface Stats {
  recordings: number;
  verified_recordings: number;
  segments: number;
  verified_segments: number;
  dialects: number;
  contributors: number;
  total_seconds: number;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/stats').then((res) => setStats(res.data));
  }, []);

  const cards = stats ? [
    { label: 'Recordings', value: stats.recordings, icon: <HiOutlineMicrophone className="w-8 h-8" />, color: 'text-amber-600 bg-amber-50' },
    { label: 'Verified', value: stats.verified_recordings, icon: <HiOutlineCheckCircle className="w-8 h-8" />, color: 'text-green-600 bg-green-50' },
    { label: 'Segments', value: stats.segments, icon: <HiOutlineChatAlt2 className="w-8 h-8" />, color: 'text-blue-600 bg-blue-50' },
    { label: 'Dialects', value: stats.dialects, icon: <HiOutlineGlobeAlt className="w-8 h-8" />, color: 'text-purple-600 bg-purple-50' },
    { label: 'Contributors', value: stats.contributors, icon: <HiOutlineUsers className="w-8 h-8" />, color: 'text-rose-600 bg-rose-50' },
    { label: 'Audio', value: formatDuration(stats.total_seconds), icon: <HiOutlineClock className="w-8 h-8" />, color: 'text-teal-600 bg-teal-50' },
  ] : [];

  return (
    <div>
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-stone-800">
          <span className="text-5xl mr-2">🪷</span> SwaraVeda
        </h1>
        <p className="text-lg text-stone-500 mt-2 max-w-2xl mx-auto">
          Community-driven digital archive preserving endangered dialects and oral traditions of India
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-stone-200 p-5 text-center">
              <div className={`inline-flex p-3 rounded-xl ${card.color} mb-3`}>
                {card.icon}
              </div>
              <div className="text-2xl font-bold text-stone-800">{card.value}</div>
              <div className="text-sm text-stone-500">{card.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <Link to="/recordings/new" className="block bg-white rounded-xl border border-stone-200 p-6 hover:border-amber-300 hover:shadow-md transition-all no-underline group">
          <div className="text-3xl mb-3">🎙️</div>
          <h3 className="text-lg font-semibold text-stone-800 group-hover:text-amber-700">Record & Upload</h3>
          <p className="text-sm text-stone-500 mt-1">Capture stories, songs, and conversations in local dialects</p>
        </Link>

        <Link to="/recordings" className="block bg-white rounded-xl border border-stone-200 p-6 hover:border-amber-300 hover:shadow-md transition-all no-underline group">
          <div className="text-3xl mb-3">📚</div>
          <h3 className="text-lg font-semibold text-stone-800 group-hover:text-amber-700">Browse Archive</h3>
          <p className="text-sm text-stone-500 mt-1">Explore recordings, correct transcriptions, and verify segments</p>
        </Link>

        <Link to="/search" className="block bg-white rounded-xl border border-stone-200 p-6 hover:border-amber-300 hover:shadow-md transition-all no-underline group">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold text-stone-800 group-hover:text-amber-700">Search</h3>
          <p className="text-sm text-stone-500 mt-1">Find recordings by keyword or semantic meaning across dialects</p>
        </Link>
      </div>
    </div>
  );
}
