import logging
import sys
import time
from pathlib import Path
from uuid import UUID

from worker.config import settings
from worker.audio import download_audio
from worker.transcriber import transcribe
from worker.diarizer import diarize, is_available as diarization_available
from worker.embedder import generate_embeddings
from worker.db import (
    claim_next_job, save_segments, update_embeddings,
    complete_job, update_job_progress,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("worker")


def process_job(job: dict):
    job_id: UUID = job["job_id"]
    recording_id: UUID = job["recording_id"]
    logger.info("Processing job %s (recording=%s, kind=%s)", job_id, recording_id, job["kind"])

    audio_path: Path | None = None
    try:
        update_job_progress(job_id, 5)
        audio_path = download_audio(job["storage_path"], job["audio_url"])
        update_job_progress(job_id, 15)

        logger.info("Starting transcription")
        segments = transcribe(audio_path)
        update_job_progress(job_id, 60)

        if diarization_available():
            logger.info("Starting diarization")
            segments = diarize(audio_path, segments)
        update_job_progress(job_id, 75)

        logger.info("Saving %d segments", len(segments))
        save_segments(recording_id, segments)
        update_job_progress(job_id, 80)

        from worker.db import engine
        from sqlmodel import Session, select
        from app.models import Segment
        with Session(engine) as session:
            saved = session.exec(
                select(Segment)
                .where(Segment.recording_id == recording_id)
                .order_by(Segment.seq)
            ).all()
            seg_dicts = [
                {"id": s.id, "asr_text": s.asr_text} for s in saved
            ]

        logger.info("Generating embeddings")
        embedding_updates = generate_embeddings(seg_dicts)
        if embedding_updates:
            update_embeddings(embedding_updates)
        update_job_progress(job_id, 95)

        complete_job(job_id)
        logger.info("Job %s completed successfully", job_id)

    except Exception as e:
        logger.exception("Job %s failed: %s", job_id, e)
        complete_job(job_id, error=str(e))

    finally:
        if audio_path and audio_path.exists():
            audio_path.unlink(missing_ok=True)


def run():
    logger.info("SwaraVeda ML Worker starting")
    logger.info("Whisper model=%s, device=%s", settings.WHISPER_MODEL, settings.WHISPER_DEVICE)
    logger.info("Diarization enabled=%s", diarization_available())
    logger.info("Embedding model=%s", settings.EMBEDDING_MODEL)
    logger.info("Polling every %ds", settings.POLL_INTERVAL)

    while True:
        try:
            job = claim_next_job()
            if job:
                process_job(job)
            else:
                time.sleep(settings.POLL_INTERVAL)
        except KeyboardInterrupt:
            logger.info("Worker stopped")
            break
        except Exception:
            logger.exception("Unexpected error in poll loop")
            time.sleep(settings.POLL_INTERVAL)


if __name__ == "__main__":
    run()
