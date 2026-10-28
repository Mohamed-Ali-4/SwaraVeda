"""Exports the corrected transcripts as a fine-tuning dataset: each segment
pairs the machine draft (asr_text) with the human correction."""
import csv
import io
import json
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import Contributor, Dialect, Recording, Segment
from app.auth import require_verifier

router = APIRouter(prefix="/export", tags=["export"])

FIELDS = [
    "segment_id", "recording_id", "recording_title", "dialect", "audio_url",
    "start_ms", "end_ms", "asr_text", "corrected_text", "transliteration",
    "translation_en", "speaker_label", "verified", "licence",
]


def _rows(session: Session, dialect_id: Optional[UUID], verified_only: bool):
    stmt = (
        select(Segment, Recording, Dialect)
        .join(Recording, Recording.id == Segment.recording_id)
        .join(Dialect, Dialect.id == Recording.dialect_id, isouter=True)
        # Only speakers who agreed to AI training, and only human-corrected text.
        .where(Recording.consent_ai_training == True)  # noqa: E712
        .where(Segment.corrected_text != None, Segment.corrected_text != "")  # noqa: E711
        .order_by(Recording.created_at, Segment.seq)
    )
    if dialect_id:
        stmt = stmt.where(Recording.dialect_id == dialect_id)
    if verified_only:
        stmt = stmt.where(Segment.verified_at != None)  # noqa: E711
    for seg, rec, dialect in session.exec(stmt):
        yield {
            "segment_id": str(seg.id),
            "recording_id": str(rec.id),
            "recording_title": rec.title,
            "dialect": dialect.name if dialect else None,
            "audio_url": rec.audio_url,
            "start_ms": seg.start_ms,
            "end_ms": seg.end_ms,
            "asr_text": seg.asr_text,
            "corrected_text": seg.corrected_text,
            "transliteration": seg.transliteration,
            "translation_en": seg.translation_en,
            "speaker_label": seg.speaker_label,
            "verified": seg.verified_at is not None,
            "licence": rec.licence,
        }


@router.get("/segments")
def export_segments(
    format: str = Query("jsonl", pattern="^(jsonl|csv)$"),
    dialect_id: Optional[UUID] = None,
    verified_only: bool = False,
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    rows = list(_rows(session, dialect_id, verified_only))
    if format == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
        body, media = buf.getvalue(), "text/csv"
    else:
        body = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
        media = "application/x-ndjson"
    filename = f"swaraveda-dataset-{date.today().isoformat()}.{format}"
    return StreamingResponse(
        iter([body]),
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
