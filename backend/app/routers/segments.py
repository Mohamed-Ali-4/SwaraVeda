from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Segment, Recording, Contributor
from app.schemas import SegmentPatch
from app.auth import current_user, require_verifier

router = APIRouter(prefix="/segments", tags=["segments"])


@router.patch("/{segment_id}", response_model=Segment)
def correct_segment(
    segment_id: UUID,
    body: SegmentPatch,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    """The core correction endpoint. asr_text is never overwritten -
    the (asr_text, corrected_text) pair is our training data."""
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(seg, k, v)
    session.add(seg)
    session.commit()
    session.refresh(seg)
    return seg


@router.post("/{segment_id}/verify", response_model=Segment)
def verify_segment(
    segment_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    if not seg.corrected_text:
        raise HTTPException(400, "Cannot verify a segment with no corrected text")

    seg.verified_by = user.id
    seg.verified_at = datetime.utcnow()
    session.add(seg)

    remaining = session.exec(
        select(Segment).where(
            Segment.recording_id == seg.recording_id,
            Segment.verified_at == None,  # noqa: E711
        )
    ).all()
    if len(remaining) <= 1:
        rec = session.get(Recording, seg.recording_id)
        if rec:
            rec.status = "verified"
            session.add(rec)

    session.commit()
    session.refresh(seg)
    return seg
