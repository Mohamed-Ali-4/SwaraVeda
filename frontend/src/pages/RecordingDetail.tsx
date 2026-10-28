import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlinePencil, HiOutlinePlay, HiOutlineSparkles } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useNlpStatus } from '../lib/nlp';
import RecordingTags from '../components/RecordingTags';

interface Segment {
  id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  asr_text?: string;
  corrected_text?: string;
  transliteration?: string;
  translation_en?: string;
  speaker_label?: string;
  verified_by?: string;
  verified_at?: string;
}

interface Recording {
  id: string;
  title: string;
  audio_url?: string;
  status: string;
  genre?: string;
  speaker_name?: string;
  duration_seconds?: number;
  notes?: string;
  created_at: string;
}

interface Job {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

const isActive = (job: Job | null) => job?.status === 'queued' || job?.status === 'running';

const statusColors: Record<string, string> = {
  uploaded: 'bg-stone-100 text-stone-600',
  transcribing: 'bg-yellow-100 text-yellow-700',
  transcribed: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
};

export default function RecordingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ corrected_text: '', transliteration: '', translation_en: '' });
  const [transcribing, setTranscribing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const nlp = useNlpStatus();

  const load = useCallback(() => {
    return api.get(`/recordings/${id}`).then((res) => {
      setRecording(res.data.recording);
      setSegments(res.data.segments);
      setJob(res.data.latest_job);
    });
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Refresh while a transcription job runs, so progress and segments appear.
  const jobActive = isActive(job);
  useEffect(() => {
    if (!jobActive) return;
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, [jobActive, load]);

  const startEdit = (seg: Segment) => {
    setEditingId(seg.id);
    setEditForm({
      corrected_text: seg.corrected_text || seg.asr_text || '',
      transliteration: seg.transliteration || '',
      translation_en: seg.translation_en || '',
    });
  };

  const saveEdit = async (segId: string) => {
    try {
      const res = await api.patch(`/segments/${segId}`, editForm);
      setSegments((prev) => prev.map((s) => (s.id === segId ? res.data : s)));
      setEditingId(null);
    } catch (err: any) {
      alert(errorMessage(err, 'Save failed'));
    }
  };

  const suggestTranslation = async (segId: string) => {
    setTranslatingId(segId);
    try {
      const res = await api.post(`/segments/${segId}/translate`, { text: editForm.corrected_text });
      setEditForm((f) => ({
        ...f,
        translation_en: res.data.translation_en || f.translation_en,
        transliteration: res.data.transliteration || f.transliteration,
      }));
    } catch (err: any) {
      alert(errorMessage(err, 'Translation failed'));
    } finally {
      setTranslatingId(null);
    }
  };

  const verifySegment = async (segId: string) => {
    try {
      const res = await api.post(`/segments/${segId}/verify`);
      setSegments((prev) => prev.map((s) => (s.id === segId ? res.data : s)));
    } catch (err: any) {
      alert(errorMessage(err, 'Verification failed'));
    }
  };

  const startTranscription = async () => {
    setTranscribing(true);
    try {
      const res = await api.post(`/recordings/${id}/transcribe`);
      setJob(res.data);
      setRecording((r) => r ? { ...r, status: 'transcribing' } : r);
    } catch (err: any) {
      alert(errorMessage(err, 'Transcription failed'));
    } finally {
      setTranscribing(false);
    }
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const playSegment = (startMs: number) => {
    const audio = document.getElementById('main-audio') as HTMLAudioElement;
    if (audio) {
      audio.currentTime = startMs / 1000;
      audio.play();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!recording) {
    return <div className="text-center py-12 text-stone-500">Recording not found</div>;
  }

  const isVerifier = user?.role === 'verifier' || user?.role === 'admin';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{recording.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-stone-500">
              {recording.genre && <span className="capitalize">{recording.genre}</span>}
              {recording.speaker_name && <span>by {recording.speaker_name}</span>}
              <span>{new Date(recording.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColors[recording.status] || 'bg-stone-100 text-stone-600'}`}>
            {recording.status}
          </span>
        </div>

        {recording.audio_url && (
          <audio id="main-audio" src={recording.audio_url} controls className="w-full mt-4" />
        )}

        <RecordingTags recordingId={recording.id} canEdit={!!user} />

        {recording.notes && (
          <p className="text-sm text-stone-500 mt-4 bg-stone-50 p-3 rounded-lg">{recording.notes}</p>
        )}

        {jobActive && job && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-stone-600 mb-1">
              <span>
                {job.status === 'queued'
                  ? nlp?.transcription === false
                    ? 'Queued: waiting for the ML worker to pick this up'
                    : 'Queued'
                  : 'Transcribing...'}
              </span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.max(job.progress, 3)}%` }} />
            </div>
          </div>
        )}

        {job?.status === 'failed' && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Transcription failed: {job.error || 'unknown error'}
          </div>
        )}

        {user && !jobActive && (recording.status === 'uploaded' || job?.status === 'failed') && (
          <button
            onClick={startTranscription}
            disabled={transcribing}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm cursor-pointer"
          >
            {transcribing ? 'Starting...' : job?.status === 'failed' ? 'Try Again' : 'Start Transcription'}
          </button>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-800">
          Segments ({segments.length})
        </h2>

        {segments.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
            {jobActive
              ? 'Transcription in progress. Segments will appear here.'
              : 'No segments yet. Start transcription to generate them.'}
          </div>
        ) : (
          segments.map((seg) => (
            <div key={seg.id} className={`bg-white rounded-xl border ${seg.verified_at ? 'border-green-200' : 'border-stone-200'} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => playSegment(seg.start_ms)}
                    className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
                    title="Play segment"
                  >
                    <HiOutlinePlay className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-stone-400">
                    {formatMs(seg.start_ms)} - {formatMs(seg.end_ms)}
                  </span>
                  {seg.speaker_label && (
                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                      {seg.speaker_label}
                    </span>
                  )}
                  {seg.verified_at && (
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full flex items-center gap-1">
                      <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {user && !seg.verified_at && (
                    <button
                      onClick={() => startEdit(seg)}
                      className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
                      title="Edit"
                    >
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                  )}
                  {isVerifier && seg.corrected_text && !seg.verified_at && (
                    <button
                      onClick={() => verifySegment(seg.id)}
                      className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 cursor-pointer"
                      title="Verify"
                    >
                      <HiOutlineCheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {editingId === seg.id ? (
                <div className="space-y-3 mt-3">
                  <div>
                    <label className="text-xs font-medium text-stone-500 block mb-1">Corrected Text</label>
                    <textarea
                      value={editForm.corrected_text}
                      onChange={(e) => setEditForm({ ...editForm, corrected_text: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-stone-500 block mb-1">Transliteration</label>
                      <input
                        value={editForm.transliteration}
                        onChange={(e) => setEditForm({ ...editForm, transliteration: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-stone-500 block mb-1">English Translation</label>
                      <input
                        value={editForm.translation_en}
                        onChange={(e) => setEditForm({ ...editForm, translation_en: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => saveEdit(seg.id)}
                      className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-1.5 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    {nlp?.translation && (
                      <button
                        onClick={() => suggestTranslation(seg.id)}
                        disabled={translatingId === seg.id}
                        className="px-4 py-1.5 border border-purple-200 text-purple-700 rounded-lg text-sm hover:bg-purple-50 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        title="Fills in translation and transliteration from the corrected text, for you to review"
                      >
                        <HiOutlineSparkles className="w-4 h-4" />
                        {translatingId === seg.id ? 'Translating...' : 'Suggest translation'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {seg.asr_text && (
                    <p className={`text-sm ${seg.corrected_text ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                      {seg.asr_text}
                    </p>
                  )}
                  {seg.corrected_text && (
                    <p className="text-sm text-stone-700 font-medium">{seg.corrected_text}</p>
                  )}
                  {seg.transliteration && (
                    <p className="text-xs text-stone-500 italic">{seg.transliteration}</p>
                  )}
                  {seg.translation_en && (
                    <p className="text-xs text-blue-600">{seg.translation_en}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
