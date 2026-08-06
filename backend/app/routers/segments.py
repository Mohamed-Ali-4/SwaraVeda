from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Segment, Recording, Contributor
from app.schemas import SegmentPatch, SegmentOut
from app.auth import current_user, require_verifier

router = APIRouter(prefix="/segments", tags=["segments"])


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(segment_id: UUID, session: Session = Depends(get_session)):
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    return seg


@router.patch("/{segment_id}", response_model=SegmentOut)
def correct_segment(
    segment_id: UUID,
    body: SegmentPatch,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(seg, k, v)
    session.add(seg)
    session.commit()
    session.refresh(seg)
    return seg


@router.post("/{segment_id}/verify", response_model=SegmentOut)
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
    seg.verified_at = datetime.now(timezone.utc)
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


@router.delete("/{segment_id}", status_code=204)
def delete_segment(
    segment_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    rec = session.get(Recording, seg.recording_id)
    if rec and rec.contributor_id != user.id and user.role not in ("admin",):
        raise HTTPException(403, "Only the recording owner or an admin can delete segments")
    session.delete(seg)
    session.commit()
