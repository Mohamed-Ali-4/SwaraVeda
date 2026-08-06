from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlmodel import Session, create_engine, select

from app.models import Job, Recording, Segment
from worker.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=2)


def claim_next_job() -> Optional[dict]:
    with Session(engine) as session:
        job = session.exec(
            select(Job)
            .where(Job.status == "queued")
            .order_by(Job.created_at)
            .limit(1)
        ).first()
        if not job:
            return None

        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()
        session.refresh(job)

        rec = session.get(Recording, job.recording_id)
        return {
            "job_id": job.id,
            "recording_id": job.recording_id,
            "kind": job.kind,
            "storage_path": rec.storage_path if rec else None,
            "audio_url": rec.audio_url if rec else None,
        }


def save_segments(recording_id: UUID, segments: list[dict]):
    with Session(engine) as session:
        existing = session.exec(
            select(Segment).where(Segment.recording_id == recording_id)
        ).all()
        for seg in existing:
            session.delete(seg)

        for seg_data in segments:
            seg = Segment(recording_id=recording_id, **seg_data)
            session.add(seg)

        session.commit()


def update_embeddings(segment_updates: list[dict]):
    """Update embedding vectors for segments via raw SQL (pgvector)."""
    from sqlalchemy import text
    with Session(engine) as session:
        for item in segment_updates:
            session.execute(
                text("UPDATE segments SET embedding = :vec WHERE id = :sid"),
                {"vec": str(item["embedding"]), "sid": str(item["segment_id"])},
            )
        session.commit()


def complete_job(job_id: UUID, error: Optional[str] = None):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job:
            return
        job.status = "failed" if error else "completed"
        job.error = error
        job.progress = 100 if not error else job.progress
        job.updated_at = datetime.now(timezone.utc)
        session.add(job)

        if not error:
            rec = session.get(Recording, job.recording_id)
            if rec:
                rec.status = "transcribed"
                session.add(rec)

        session.commit()


def update_job_progress(job_id: UUID, progress: int):
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job:
            job.progress = progress
            job.updated_at = datetime.now(timezone.utc)
            session.add(job)
            session.commit()
