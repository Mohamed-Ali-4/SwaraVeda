import uuid as uuidlib
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.db import get_session
from app.models import Recording, Segment, Contributor, Job
from app.schemas import (
    RecordingIn, RecordingPatch, RecordingOut, RecordingDetail,
    UploadUrlIn, UploadUrlOut, SegmentOut, JobOut, Page,
)
from app.auth import current_user
from app.storage import create_signed_upload, public_url

router = APIRouter(prefix="/recordings", tags=["recordings"])


@router.post("/upload-url", response_model=UploadUrlOut)
def upload_url(body: UploadUrlIn, user: Contributor = Depends(current_user)):
    ext = body.filename.rsplit(".", 1)[-1] if "." in body.filename else "webm"
    path = f"{user.id}/{uuidlib.uuid4()}.{ext}"
    signed = create_signed_upload(path)
    return UploadUrlOut(upload_url=signed["url"], storage_path=path, token=signed.get("token"))


@router.post("", response_model=RecordingOut, status_code=201)
def create_recording(
    body: RecordingIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    data = body.model_dump()
    if data.get("storage_path") and not data.get("audio_url"):
        data["audio_url"] = public_url(data["storage_path"])
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
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = select(Recording)
    count_stmt = select(func.count()).select_from(Recording)

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
def get_recording(recording_id: UUID, session: Session = Depends(get_session)):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    segments = session.exec(
        select(Segment).where(Segment.recording_id == recording_id).order_by(Segment.seq)
    ).all()
    return {"recording": rec, "segments": segments}


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
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")

    job = Job(recording_id=recording_id, kind="transcribe", status="queued")
    rec.status = "transcribing"
    session.add(job)
    session.add(rec)
    session.commit()
    session.refresh(job)
    return job


@router.get("/{recording_id}/segments", response_model=List[SegmentOut])
def list_segments(recording_id: UUID, session: Session = Depends(get_session)):
    return session.exec(
        select(Segment).where(Segment.recording_id == recording_id).order_by(Segment.seq)
    ).all()
