import { useEffect, useState, type FormEvent } from 'react';
import { HiOutlineTag, HiOutlineX } from 'react-icons/hi';
import api from '../lib/api';

interface Tag {
  id: string;
  label: string;
}

export default function RecordingTags({ recordingId, canEdit }: { recordingId: string; canEdit: boolean }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    api.get(`/tags/${recordingId}/tags`).then((res) => setTags(res.data));
  }, [recordingId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const wanted = label.trim().toLowerCase();
    if (!wanted || tags.some((t) => t.label.toLowerCase() === wanted)) return;
    try {
      // Reuse an existing tag with this label, so the archive shares one vocabulary.
      const all: Tag[] = (await api.get('/tags')).data;
      const tag = all.find((t) => t.label.toLowerCase() === wanted)
        ?? (await api.post('/tags', { label: wanted })).data;
      const res = await api.post(`/tags/${recordingId}/tags`, { tag_id: tag.id });
      setTags((prev) => [...prev, res.data]);
      setLabel('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not add tag');
    }
  };

  const remove = async (tag: Tag) => {
    try {
      await api.delete(`/tags/${recordingId}/tags/${tag.id}`);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not remove tag');
    }
  };

  if (!canEdit && tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4">
      <HiOutlineTag className="w-4 h-4 text-stone-400" />
      {tags.map((t) => (
        <span key={t.id} className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-800 rounded-full">
          {t.label}
          {canEdit && (
            <button onClick={() => remove(t)} className="hover:text-amber-950 cursor-pointer" title="Remove tag">
              <HiOutlineX className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <form onSubmit={add}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Add tag (e.g. harvest, wedding)"
            className="text-xs px-2 py-1 border border-stone-200 rounded-full w-52 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </form>
      )}
    </div>
  );
}
