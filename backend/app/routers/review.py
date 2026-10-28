"""The review queue: segments waiting for a human. Contributors correct the
machine draft; verifiers sign off corrections."""
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.auth import current_user
from app.db import get_session
from app.models import Contributor, Dialect, Recording, Segment
from app.schemas import ReviewQueue

router = APIRouter(prefix="/review", tags=["review"])

has_correction = (Segment.corrected_text != None) & (Segment.corrected_text != "")  # noqa: E711
STATES = {
    "needs_correction": ~has_correction & (Segment.asr_text != None),  # noqa: E711
    "needs_verification": has_correction & (Segment.verified_at == None),  # noqa: E711
    "verified": Segment.verified_at != None,  # noqa: E711
}


@router.get("/segments", response_model=ReviewQueue)
def review_queue(
    state: Literal["needs_correction", "needs_verification", "verified"] = "needs_verification",
    dialect_id: Optional[UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    def scoped(stmt):
        stmt = stmt.join(Recording, Recording.id == Segment.recording_id)
        return stmt.where(Recording.dialect_id == dialect_id) if dialect_id else stmt

    counts = {
        name: session.exec(scoped(select(func.count()).select_from(Segment)).where(cond)).one()
        for name, cond in STATES.items()
    }
    rows = session.exec(
        scoped(select(Segment, Recording, Dialect))
        .join(Dialect, Dialect.id == Recording.dialect_id, isouter=True)
        .where(STATES[state])
        .order_by(Recording.created_at.desc(), Segment.seq)
        .limit(limit)
    ).all()
    items = [
        {
            "segment": seg,
            "recording_id": rec.id,
            "recording_title": rec.title,
            "audio_url": rec.audio_url,
            "dialect_name": dialect.name if dialect else None,
        }
        for seg, rec, dialect in rows
    ]
    return {"counts": counts, "items": items}
