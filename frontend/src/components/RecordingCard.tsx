import { Link } from 'react-router-dom';
import { HiOutlineClock, HiOutlineLockClosed, HiOutlineUser } from 'react-icons/hi';
import type { Recording } from '../lib/types';
import { capitalize, date, duration } from '../lib/format';
import { StatusBadge } from './ui';

export default function RecordingCard({ rec, dialect }: { rec: Recording; dialect?: string }) {
  return (
    <Link
      to={`/recordings/${rec.id}`}
      className="group flex flex-col rounded-card border border-line bg-surface p-5 no-underline shadow-card transition hover:-translate-y-0.5 hover:border-saffron-300 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-saffron-600">
          {dialect || 'Dialect not set'}
        </p>
        <StatusBadge status={rec.status} />
      </div>
      <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-ink group-hover:text-saffron-700 line-clamp-2">
        {rec.title}
      </h3>
      <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {rec.genre && <span>{capitalize(rec.genre)}</span>}
        {rec.speaker_name && (
          <span className="flex items-center gap-1"><HiOutlineUser className="w-4 h-4" />{rec.speaker_name}</span>
        )}
        {rec.duration_seconds ? (
          <span className="flex items-center gap-1 tabular"><HiOutlineClock className="w-4 h-4" />{duration(rec.duration_seconds)}</span>
        ) : null}
        {!rec.consent_public && (
          <span className="flex items-center gap-1" title="Only you, verifiers and admins can see this recording">
            <HiOutlineLockClosed className="w-4 h-4" />Private
          </span>
        )}
        <span className="ml-auto text-faint">{date(rec.created_at)}</span>
      </div>
    </Link>
  );
}
