"""Transcription pipeline that runs inside the API as a background task when
hosted NLP is configured (see app.nlp). Mirrors what the local ML worker does."""
import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlmodel import Session, select

from app import nlp
from app.config import settings
from app.db import new_session
from app.models import Dialect, Job, Recording, Segment
from app.storage import public_url

logger = logging.getLogger(__name__)


def _update_job(session: Session, job: Job, **fields) -> None:
    for k, v in fields.items():
        setattr(job, k, v)
    job.updated_at = datetime.now(timezone.utc)
    session.add(job)
    session.commit()


def _download(rec: Recording) -> tuple[bytes, str]:
    url = rec.audio_url or (public_url(rec.storage_path) if rec.storage_path else None)
    if not url:
        raise nlp.NLPError("This recording has no audio file")
    limit = settings.MAX_AUDIO_MB * 1024 * 1024
    buf = bytearray()
    with httpx.stream("GET", url, follow_redirects=True, timeout=120) as resp:
        if resp.status_code != 200:
            raise nlp.NLPError(f"Couldn't download the audio (HTTP {resp.status_code})")
        for chunk in resp.iter_bytes():
            buf.extend(chunk)
            if len(buf) > limit:
                raise nlp.NLPError(
                    f"Audio is larger than {settings.MAX_AUDIO_MB} MB; split or compress it"
                )
    name = (rec.storage_path or url).rsplit("/", 1)[-1].split("?")[0] or "audio.webm"
    return bytes(buf), name


def embed_segments(session: Session, segments: list[Segment]) -> int:
    items = [
        (s.id, s.corrected_text or s.asr_text)
        for s in segments
        if (s.corrected_text or s.asr_text or "").strip()
    ]
    if not items:
        return 0
    vectors = nlp.embed_texts([t for _, t in items])
    if session.get_bind().dialect.name == "postgresql":
        for (sid, _), vec in zip(items, vectors):
            session.execute(
                text("update segments set embedding = cast(:vec as vector) where id = :sid"),
                {"vec": str(vec), "sid": str(sid)},
            )
        session.commit()
    return len(vectors)


def run_transcription(job_id: UUID) -> None:
    with new_session() as session:
        job = session.get(Job, job_id)
        if not job:
            return
        rec = session.get(Recording, job.recording_id)
        try:
            if not rec:
                raise nlp.NLPError("Recording no longer exists")
            _update_job(session, job, status="running", progress=5, error=None)

            audio, filename = _download(rec)
            _update_job(session, job, progress=20)

            dialect = session.get(Dialect, rec.dialect_id) if rec.dialect_id else None
            segments, duration = nlp.transcribe_audio(
                audio, filename, dialect.asr_language if dialect else None
            )
            _update_job(session, job, progress=70)

            for old in session.exec(select(Segment).where(Segment.recording_id == rec.id)).all():
                session.delete(old)
            saved = [Segment(recording_id=rec.id, **s) for s in segments]
            session.add_all(saved)
            if duration and not rec.duration_seconds:
                rec.duration_seconds = round(duration, 1)
            rec.status = "transcribed"
            session.add(rec)
            session.commit()
            _update_job(session, job, progress=85)

            if nlp.embeddings_enabled():
                try:
                    embed_segments(session, saved)
                except Exception:
                    # Search falls back to keywords; the transcript is still usable.
                    session.rollback()
                    logger.exception("Embedding failed for recording %s", rec.id)

            _update_job(session, job, status="completed", progress=100)
            logger.info("Job %s completed: %d segments", job_id, len(saved))
        except Exception as e:
            logger.exception("Job %s failed", job_id)
            session.rollback()
            if rec and rec.status == "transcribing":
                rec.status = "uploaded"
                session.add(rec)
            _update_job(session, job, status="failed", error=str(e)[:500])


def reembed_segment(segment_id: UUID) -> None:
    with new_session() as session:
        seg = session.get(Segment, segment_id)
        if not seg:
            return
        try:
            embed_segments(session, [seg])
        except Exception:
            logger.exception("Re-embedding segment %s failed", segment_id)
