import uuid as uuidlib
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import true
from sqlmodel import Session, select, func

from app.db import get_session
from app.models import Recording, Segment, Contributor, Job
from app.schemas import (
    RecordingIn, RecordingPatch, RecordingOut, RecordingDetail,
    UploadUrlIn, UploadUrlOut, SegmentOut, JobOut, Page,
)
from app.auth import can_see_private, current_user, optional_user
from app.storage import StorageError, create_signed_upload, public_url
from app import nlp
from app.pipeline import run_transcription

# A job that hasn't reported progress for this long is assumed dead (e.g. the
# server restarted mid-job) and can be replaced by a new one.
STALE_JOB_AFTER = timedelta(minutes=15)


def visible_to(user: Optional[Contributor]):
    """Recordings without public-listening consent are shown only to the
    person who uploaded them, verifiers and admins."""
    if can_see_private(user):
        return true()
    public = Recording.consent_public == True  # noqa: E712
    return public | (Recording.contributor_id == user.id) if user else public


def _get_visible(session: Session, recording_id: UUID, user: Optional[Contributor]) -> Recording:
    rec = session.get(Recording, recording_id)
    if not rec or not (
        rec.consent_public or can_see_private(user) or (user and rec.contributor_id == user.id)
    ):
        raise HTTPException(404, "Recording not found")
    return rec


def _latest_job(session: Session, recording_id: UUID) -> Optional[Job]:
    return session.exec(
        select(Job).where(Job.recording_id == recording_id).order_by(Job.created_at.desc())
    ).first()


def _is_active(job: Optional[Job]) -> bool:
    if not job or job.status not in ("queued", "running"):
        return False
    updated = job.updated_at
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - updated < STALE_JOB_AFTER

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.post("/upload-url", response_model=UploadUrlOut)
def upload_url(body: UploadUrlIn, user: Contributor = Depends(current_user)):
    ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else "webm"
    path = f"{user.id}/{uuidlib.uuid4()}.{ext}"
    try:
        signed = create_signed_upload(path)
    except StorageError as e:
        raise HTTPException(502, f"Audio storage isn't reachable, so the upload can't start. {e}")
    return UploadUrlOut(upload_url=signed["url"], storage_path=path, token=signed.get("token"))


@router.post("", response_model=RecordingOut, status_code=201)
def create_recording(
    body: RecordingIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    data = body.model_dump()
    if not data.get("licence"):
        data.pop("licence")  # keep the archive's default licence
    if data.get("storage_path") and not data.get("audio_url"):
        try:
            data["audio_url"] = public_url(data["storage_path"])
        except StorageError as e:
            raise HTTPException(502, f"Audio storage isn't reachable. {e}")
    rec = Recording(**data, contributor_id=user.id)
    session.add(rec)
    session.commit()
    session.refresh(rec)
    return rec


@router.get("", response_model=Page)
def list_recordings(
    session: Session = Depends(get_session),
    dialect_id: Optional[UUID] = None,
    genre: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = Query(None, description="Search titles and speakers"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: Optional[Contributor] = Depends(optional_user),
):
    visible = visible_to(user)
    stmt = select(Recording).where(visible)
    count_stmt = select(func.count()).select_from(Recording).where(visible)
    if q and q.strip():
        like = f"%{q.strip()}%"
        match = Recording.title.ilike(like) | Recording.speaker_name.ilike(like)
        stmt = stmt.where(match)
        count_stmt = count_stmt.where(match)

    for col, val in (
        (Recording.dialect_id, dialect_id),
        (Recording.genre, genre),
        (Recording.status, status),
    ):
        if val is not None:
            stmt = stmt.where(col == val)
            count_stmt = count_stmt.where(col == val)

    total = session.exec(count_stmt).one()
    items = session.exec(
        stmt.order_by(Recording.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{recording_id}", response_model=RecordingDetail)
def get_recording(
    recording_id: UUID,
    session: Session = Depends(get_session),
    user: Optional[Contributor] = Depends(optional_user),
):
    rec = _get_visible(session, recording_id, user)
    segments = session.exec(
        select(Segment).where(Segment.recording_id == recording_id).order_by(Segment.seq)
    ).all()
    return {"recording": rec, "segments": segments, "latest_job": _latest_job(session, recording_id)}


@router.patch("/{recording_id}", response_model=RecordingOut)
def patch_recording(
    recording_id: UUID,
    body: RecordingPatch,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    if rec.contributor_id != user.id and user.role not in ("verifier", "admin"):
        raise HTTPException(403, "Not your recording")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    session.add(rec)
    session.commit()
    session.refresh(rec)
    return rec


@router.delete("/{recording_id}", status_code=204)
def delete_recording(
    recording_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    if rec.contributor_id != user.id and user.role not in ("admin",):
        raise HTTPException(403, "Only the owner or an admin can delete")
    session.delete(rec)
    session.commit()


@router.post("/{recording_id}/transcribe", response_model=JobOut)
def transcribe(
    recording_id: UUID,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    latest = _latest_job(session, recording_id)
    if _is_active(latest):
        return latest

    job = Job(recording_id=recording_id, kind="transcribe", status="queued")
    rec.status = "transcribing"
    session.add(job)
    session.add(rec)
    session.commit()
    session.refresh(job)
    # Without hosted NLP the job stays queued for the local ML worker.
    if nlp.transcription_enabled():
        background.add_task(run_transcription, job.id)
    return job


@router.get("/{recording_id}/segments", response_model=List[SegmentOut])
def list_segments(
    recording_id: UUID,
    session: Session = Depends(get_session),
    user: Optional[Contributor] = Depends(optional_user),
):
    _get_visible(session, recording_id, user)
    return session.exec(
        select(Segment).where(Segment.recording_id == recording_id).order_by(Segment.seq)
    ).all()
