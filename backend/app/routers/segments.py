from datetime import datetime, timezone
from uuid import UUID

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from sqlmodel import Session, select

from app import nlp
from app.db import get_session
from app.models import Segment, Recording, Contributor, Dialect
from app.schemas import SegmentPatch, SegmentOut, TranslateIn, TranslationOut
from app.auth import current_user, optional_user, require_verifier
from app.pipeline import reembed_segment

router = APIRouter(prefix="/segments", tags=["segments"])


@router.get("/{segment_id}", response_model=SegmentOut)
def get_segment(
    segment_id: UUID,
    session: Session = Depends(get_session),
    user: Optional[Contributor] = Depends(optional_user),
):
    from app.routers.recordings import _get_visible
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    try:
        _get_visible(session, seg.recording_id, user)
    except HTTPException:
        raise HTTPException(404, "Segment not found")
    return seg


@router.patch("/{segment_id}", response_model=SegmentOut)
def correct_segment(
    segment_id: UUID,
    body: SegmentPatch,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")

    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(seg, k, v)
    session.add(seg)
    session.commit()
    session.refresh(seg)
    # Semantic search should find the corrected wording, not the ASR draft.
    if "corrected_text" in changes and nlp.embeddings_enabled():
        background.add_task(reembed_segment, seg.id)
    return seg


@router.post("/{segment_id}/translate", response_model=TranslationOut)
def translate_segment(
    segment_id: UUID,
    body: Optional[TranslateIn] = Body(default=None),
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    """Suggests an English translation and Latin transliteration. Nothing is
    saved: the contributor reviews the suggestion and saves it with PATCH."""
    if not nlp.translation_enabled():
        raise HTTPException(503, "AI translation isn't set up on this server (GROQ_API_KEY is missing).")
    seg = session.get(Segment, segment_id)
    if not seg:
        raise HTTPException(404, "Segment not found")
    source = (body.text if body else None) or seg.corrected_text or seg.asr_text
    if not (source or "").strip():
        raise HTTPException(400, "This segment has no text to translate")

    rec = session.get(Recording, seg.recording_id)
    dialect = session.get(Dialect, rec.dialect_id) if rec and rec.dialect_id else None
    try:
        return nlp.translate_text(
            source,
            dialect.name if dialect else None,
            dialect.script if dialect else None,
        )
    except nlp.NLPError as e:
        raise HTTPException(502, str(e))


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
