import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineMicrophone, HiOutlineStop, HiOutlineUpload } from 'react-icons/hi';
import api from '../lib/api';

interface Dialect {
  id: string;
  name: string;
}

export default function NewRecording() {
  const navigate = useNavigate();
  const [dialects, setDialects] = useState<Dialect[]>([]);
  const [title, setTitle] = useState('');
  const [dialectId, setDialectId] = useState('');
  const [genre, setGenre] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    api.get('/dialects').then((res) => setDialects(res.data));
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setError('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const clearRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!audioBlob) {
      setError('Please record or upload audio first');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const uploadRes = await api.post('/recordings/upload-url', {
        filename: `recording-${Date.now()}.webm`,
        content_type: 'audio/webm',
      });
      const { upload_url, storage_path, token } = uploadRes.data;

      const headers: Record<string, string> = { 'Content-Type': 'audio/webm' };
      if (token) headers['x-upsert'] = 'true';

      await fetch(upload_url, {
        method: 'PUT',
        body: audioBlob,
        headers,
      });

      await api.post('/recordings', {
        title,
        storage_path,
        duration_seconds: duration,
        dialect_id: dialectId || undefined,
        genre: genre || undefined,
        speaker_name: speakerName || undefined,
        notes: notes || undefined,
        consent_public: true,
        consent_ai_training: true,
      });

      navigate('/recordings');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">New Recording</h1>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
        <h2 className="font-semibold text-stone-700 mb-4">Audio</h2>

        {!audioBlob ? (
          <div className="flex flex-col items-center py-8">
            {recording ? (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4 animate-pulse">
                  <HiOutlineMicrophone className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-lg font-mono text-stone-700 mb-4">{formatTime(duration)}</p>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 cursor-pointer"
                >
                  <HiOutlineStop className="w-5 h-5" />
                  Stop Recording
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-4 hover:bg-amber-200 transition-colors cursor-pointer"
                >
                  <HiOutlineMicrophone className="w-10 h-10 text-amber-600" />
                </button>
                <p className="text-stone-500">Click to start recording</p>
                <p className="text-xs text-stone-400 mt-2">or upload a file below</p>
                <label className="mt-4 flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg text-sm text-stone-600 hover:bg-stone-50 cursor-pointer">
                  <HiOutlineUpload className="w-5 h-5" />
                  Upload Audio File
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAudioBlob(file);
                        setAudioUrl(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <audio src={audioUrl!} controls className="w-full" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">{formatTime(duration)}</span>
              <button onClick={clearRecording} className="text-sm text-red-500 hover:text-red-600 cursor-pointer">
                Discard & re-record
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <h2 className="font-semibold text-stone-700">Details</h2>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="e.g., Grandmother's lullaby in Tulu"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Dialect</label>
            <select
              value={dialectId}
              onChange={(e) => setDialectId(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Select dialect</option>
              {dialects.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Genre</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="">Select genre</option>
              <option value="conversation">Conversation</option>
              <option value="narrative">Narrative</option>
              <option value="song">Song</option>
              <option value="prayer">Prayer</option>
              <option value="proverb">Proverb</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Speaker Name</label>
          <input
            type="text"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            placeholder="Name of the person speaking"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            placeholder="Context, location, or any additional details"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !audioBlob}
          className="w-full py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 font-medium transition-colors cursor-pointer"
        >
          {submitting ? 'Uploading...' : 'Upload Recording'}
        </button>
      </form>
    </div>
  );
}
