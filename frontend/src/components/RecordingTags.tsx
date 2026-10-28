import { useEffect, useState, type FormEvent } from 'react';
import { HiOutlineTag, HiOutlineX, HiOutlinePlus } from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { useToast } from '../lib/toast';

interface Tag {
  id: string;
  label: string;
}

export default function RecordingTags({ recordingId, canEdit }: { recordingId: string; canEdit: boolean }) {
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.get(`/tags/${recordingId}/tags`).then((res) => setTags(res.data)).catch(() => {});
  }, [recordingId]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const wanted = label.trim().toLowerCase();
    if (!wanted) return setAdding(false);
    if (tags.some((t) => t.label.toLowerCase() === wanted)) return setLabel('');
    try {
      // Reuse an existing tag with this label, so the archive shares one vocabulary.
      const all: Tag[] = (await api.get('/tags')).data;
      const tag = all.find((t) => t.label.toLowerCase() === wanted)
        ?? (await api.post('/tags', { label: wanted })).data;
      const res = await api.post(`/tags/${recordingId}/tags`, { tag_id: tag.id });
      setTags((prev) => [...prev, res.data]);
      setLabel('');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add tag'));
    }
  };

  const remove = async (tag: Tag) => {
    try {
      await api.delete(`/tags/${recordingId}/tags/${tag.id}`);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove tag'));
    }
  };

  if (!canEdit && tags.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <HiOutlineTag className="w-4 h-4 text-faint" aria-label="Tags" />
      {tags.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-saffron-50 px-2.5 py-0.5 text-sm text-saffron-700">
          {t.label}
          {canEdit && (
            <button onClick={() => remove(t)} className="rounded-full hover:text-saffron-900" aria-label={`Remove tag ${t.label}`}>
              <HiOutlineX className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      ))}
      {canEdit && (adding ? (
        <form onSubmit={add}>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => !label && setAdding(false)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="harvest, wedding…"
            aria-label="New tag"
            className="w-40 rounded-full border border-line-strong bg-surface px-3 py-0.5 text-sm focus:border-saffron-500 focus:outline-none"
          />
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-sm text-muted hover:border-saffron-300 hover:text-saffron-700">
          <HiOutlinePlus className="w-3.5 h-3.5" /> Add tag
        </button>
      ))}
    </div>
  );
}
