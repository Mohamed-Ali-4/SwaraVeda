import { forwardRef, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  HiOutlinePlay, HiOutlinePencil, HiOutlineBadgeCheck, HiOutlineSparkles, HiOutlineRefresh, HiCheck,
} from 'react-icons/hi';
import api, { errorMessage } from '../lib/api';
import { clock } from '../lib/format';
import type { AudioPlayer } from '../lib/player';
import { input } from '../lib/styles';
import { useToast } from '../lib/toast';
import type { Segment } from '../lib/types';
import { segmentState, type SegmentState } from '../lib/segments';
import { Button, Chip, Kbd } from './ui';


function StateChip({ state }: { state: SegmentState }) {
  if (state === 'verified') return <Chip className="bg-leaf-50 text-leaf-700"><HiOutlineBadgeCheck className="w-3.5 h-3.5" />Verified</Chip>;
  if (state === 'corrected') return <Chip className="bg-saffron-50 text-saffron-700"><HiCheck className="w-3.5 h-3.5" />Corrected</Chip>;
  return <Chip className="bg-lotus-50 text-lotus-600"><HiOutlineSparkles className="w-3.5 h-3.5" />AI draft</Chip>;
}

interface Props {
  seg: Segment;
  active: boolean;
  focused: boolean;
  editing: boolean;
  canEdit: boolean;
  canVerify: boolean;
  canTranslate: boolean;
  player: AudioPlayer;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (seg: Segment, goNext: boolean) => void;
}

function Editor({ seg, canVerify, canTranslate, player, onCancel, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState({
    corrected_text: seg.corrected_text || seg.asr_text || '',
    transliteration: seg.transliteration || '',
    translation_en: seg.translation_en || '',
  });
  const [saving, setSaving] = useState<false | 'save' | 'next' | 'verify'>(false);
  const [translating, setTranslating] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const looping = player.looping?.start === seg.start_ms;

  const { stopLoop } = player;
  useEffect(() => {
    textRef.current?.focus();
    textRef.current?.setSelectionRange(textRef.current.value.length, textRef.current.value.length);
    return () => stopLoop();
  }, [stopLoop]);

  const save = async (mode: 'save' | 'next' | 'verify') => {
    if (!form.corrected_text.trim()) {
      toast.error('The corrected text can’t be empty.');
      return;
    }
    setSaving(mode);
    try {
      let res = await api.patch(`/segments/${seg.id}`, {
        corrected_text: form.corrected_text.trim(),
        transliteration: form.transliteration.trim() || null,
        translation_en: form.translation_en.trim() || null,
      });
      if (mode === 'verify') res = await api.post(`/segments/${seg.id}/verify`);
      toast.success(mode === 'verify' ? 'Saved and verified.' : 'Correction saved.');
      onSaved(res.data, mode !== 'save');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
      setSaving(false);
    }
  };

  const suggest = async () => {
    setTranslating(true);
    try {
      const res = await api.post(`/segments/${seg.id}/translate`, { text: form.corrected_text });
      setForm((f) => ({
        ...f,
        translation_en: res.data.translation_en || f.translation_en,
        transliteration: res.data.transliteration || f.transliteration,
      }));
      toast.success('Suggestion added. Check it before saving.');
    } catch (err) {
      toast.error(errorMessage(err, 'Translation failed'));
    } finally {
      setTranslating(false);
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save('next'); }
    if (e.key === 'p' && e.altKey) { e.preventDefault(); player.playRange(seg.start_ms, seg.end_ms); }
  };

  return (
    <div className="mt-3 space-y-4" onKeyDown={onKey}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => player.playRange(seg.start_ms, seg.end_ms)} icon={<HiOutlinePlay className="w-4 h-4" />}>
          Play passage
        </Button>
        <Button
          size="sm"
          variant={looping ? 'primary' : 'secondary'}
          onClick={() => (looping ? (player.stopLoop(), player.pause()) : player.playRange(seg.start_ms, seg.end_ms, true))}
          icon={<HiOutlineRefresh className="w-4 h-4" />}
          aria-pressed={looping}
        >
          {looping ? 'Looping' : 'Loop'}
        </Button>
        {[0.75, 1].map((r) => (
          <button
            key={r}
            onClick={() => player.setRate(r)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${player.rate === r ? 'bg-ink text-white' : 'text-muted hover:bg-sunken'}`}
          >
            {r}×
          </button>
        ))}
      </div>

      {seg.asr_text && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
          <span className="mr-2 font-medium text-lotus-600">AI heard:</span>
          <span className="font-script">{seg.asr_text}</span>
        </p>
      )}

      <div>
        <label htmlFor={`fix-${seg.id}`} className="mb-1.5 block text-sm font-medium text-ink-soft">What was actually said</label>
        <textarea
          id={`fix-${seg.id}`}
          ref={textRef}
          rows={2}
          value={form.corrected_text}
          onChange={(e) => setForm({ ...form, corrected_text: e.target.value })}
          className={`${input} resize-y font-script text-lg leading-relaxed`}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`tr-${seg.id}`} className="mb-1.5 block text-sm font-medium text-ink-soft">In Latin letters</label>
          <input id={`tr-${seg.id}`} value={form.transliteration} onChange={(e) => setForm({ ...form, transliteration: e.target.value })} className={input} placeholder="e.g. ballāḷa kōṭeḍ maḷe" />
        </div>
        <div>
          <label htmlFor={`en-${seg.id}`} className="mb-1.5 block text-sm font-medium text-ink-soft">English meaning</label>
          <input id={`en-${seg.id}`} value={form.translation_en} onChange={(e) => setForm({ ...form, translation_en: e.target.value })} className={input} placeholder="e.g. Rain at the Ballala fort" />
        </div>
      </div>
      {canTranslate && (
        <Button size="sm" variant="ai" onClick={suggest} loading={translating} icon={<HiOutlineSparkles className="w-4 h-4" />}>
          {translating ? 'Asking AI…' : 'Suggest English & Latin with AI'}
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {canVerify && (
          <Button variant="verify" onClick={() => save('verify')} loading={saving === 'verify'} disabled={!!saving} icon={<HiOutlineBadgeCheck className="w-4 h-4" />}>
            Save & verify
          </Button>
        )}
        <Button onClick={() => save('next')} loading={saving === 'next'} disabled={!!saving}>Save & next</Button>
        <Button variant="secondary" onClick={() => save('save')} loading={saving === 'save'} disabled={!!saving}>Save</Button>
        <Button variant="ghost" onClick={onCancel} disabled={!!saving}>Cancel</Button>
        <span className="ml-auto hidden lg:flex items-center gap-1.5 text-xs text-muted">
          <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> save & next · <Kbd>Alt</Kbd>+<Kbd>P</Kbd> play · <Kbd>Esc</Kbd> cancel
        </span>
      </div>
    </div>
  );
}

const SegmentItem = forwardRef<HTMLLIElement, Props>(function SegmentItem(props, ref) {
  const { seg, active, focused, editing, canEdit, canVerify, player, onEdit, onSaved } = props;
  const toast = useToast();
  const [verifying, setVerifying] = useState(false);
  const state = segmentState(seg);

  const verify = async () => {
    setVerifying(true);
    try {
      const res = await api.post(`/segments/${seg.id}/verify`);
      toast.success('Passage verified.');
      onSaved(res.data, false);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not verify'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <li
      ref={ref}
      id={`seg-${seg.id}`}
      className={`scroll-mt-48 rounded-xl border p-4 transition-colors ${
        editing ? 'border-saffron-500 bg-surface shadow-lift'
          : active ? 'border-saffron-300 bg-saffron-50'
          : focused ? 'border-river-500 bg-river-50'
          : 'border-line bg-surface hover:border-line-strong'
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        <button
          onClick={() => player.playRange(seg.start_ms, seg.end_ms)}
          className={`group flex h-fit shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-xs tabular ${
            active ? 'bg-saffron-500 text-white' : 'bg-sunken text-muted hover:bg-saffron-100 hover:text-saffron-700'
          }`}
          aria-label={`Play passage at ${clock(seg.start_ms)}`}
        >
          <HiOutlinePlay className="w-3.5 h-3.5" />
          {clock(seg.start_ms)}
        </button>

        <div className="min-w-0 flex-1">
          {!editing && (
            <div className="space-y-1">
              <p
                onClick={() => player.seek(seg.start_ms)}
                className={`font-script text-[1.08rem] leading-relaxed text-ink cursor-text ${state === 'draft' ? 'text-ink-soft' : ''}`}
              >
                {seg.corrected_text || seg.asr_text || <span className="text-faint">(no speech)</span>}
              </p>
              {seg.corrected_text && seg.asr_text && seg.asr_text !== seg.corrected_text && (
                <p className="text-xs text-faint"><span className="font-medium">AI heard:</span> <span className="line-through">{seg.asr_text}</span></p>
              )}
              {seg.transliteration && <p className="text-sm italic text-muted">{seg.transliteration}</p>}
              {seg.translation_en && <p className="text-[15px] text-river-600">{seg.translation_en}</p>}
            </div>
          )}
          {editing && <Editor {...props} />}
        </div>

        {!editing && (
          <div className="flex shrink-0 flex-col-reverse items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex gap-0.5">
              {canEdit && state !== 'verified' && (
                <button onClick={onEdit} className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink" aria-label="Correct this passage" title="Correct (E)">
                  <HiOutlinePencil className="w-[18px] h-[18px]" />
                </button>
              )}
              {canVerify && state === 'corrected' && (
                <button onClick={verify} disabled={verifying} className="rounded-lg p-1.5 text-leaf-600 hover:bg-leaf-50" aria-label="Verify this passage" title="Verify">
                  <HiOutlineBadgeCheck className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
            <StateChip state={state} />
          </div>
        )}
      </div>
    </li>
  );
});

export default SegmentItem;
