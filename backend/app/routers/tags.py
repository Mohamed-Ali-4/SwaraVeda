from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Tag, RecordingTag, Recording, Contributor
from app.schemas import TagIn, TagOut, RecordingTagIn
from app.auth import current_user

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=List[TagOut])
def list_tags(session: Session = Depends(get_session)):
    return session.exec(select(Tag).order_by(Tag.label)).all()


@router.post("", response_model=TagOut, status_code=201)
def create_tag(
    body: TagIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    existing = session.exec(select(Tag).where(Tag.label == body.label)).first()
    if existing:
        raise HTTPException(409, "Tag already exists")
    tag = Tag(**body.model_dump())
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


@router.get("/{tag_id}", response_model=TagOut)
def get_tag(tag_id: UUID, session: Session = Depends(get_session)):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(
    tag_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    if user.role != "admin":
        raise HTTPException(403, "Admin role required")
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")
    session.delete(tag)
    session.commit()


@router.post("/{recording_id}/tags", response_model=TagOut, status_code=201)
def add_tag_to_recording(
    recording_id: UUID,
    body: RecordingTagIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    tag = session.get(Tag, body.tag_id)
    if not tag:
        raise HTTPException(404, "Tag not found")

    existing = session.exec(
        select(RecordingTag).where(
            RecordingTag.recording_id == recording_id,
            RecordingTag.tag_id == body.tag_id,
        )
    ).first()
    if existing:
        raise HTTPException(409, "Tag already attached to this recording")

    rt = RecordingTag(recording_id=recording_id, tag_id=body.tag_id)
    session.add(rt)
    session.commit()
    return tag


@router.delete("/{recording_id}/tags/{tag_id}", status_code=204)
def remove_tag_from_recording(
    recording_id: UUID,
    tag_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    rt = session.exec(
        select(RecordingTag).where(
            RecordingTag.recording_id == recording_id,
            RecordingTag.tag_id == tag_id,
        )
    ).first()
    if not rt:
        raise HTTPException(404, "Tag not attached to this recording")
    session.delete(rt)
    session.commit()


@router.get("/{recording_id}/tags", response_model=List[TagOut])
def list_recording_tags(
    recording_id: UUID,
    session: Session = Depends(get_session),
):
    rec = session.get(Recording, recording_id)
    if not rec:
        raise HTTPException(404, "Recording not found")
    tags = session.exec(
        select(Tag).join(RecordingTag).where(RecordingTag.recording_id == recording_id)
    ).all()
    return tags
