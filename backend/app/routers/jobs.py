from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.db import get_session
from app.models import Job, Contributor
from app.schemas import JobOut, Page
from app.auth import current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=Page)
def list_jobs(
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
    status: Optional[str] = None,
    recording_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = select(Job)
    count_stmt = select(func.count()).select_from(Job)

    if status:
        stmt = stmt.where(Job.status == status)
        count_stmt = count_stmt.where(Job.status == status)
    if recording_id:
        stmt = stmt.where(Job.recording_id == recording_id)
        count_stmt = count_stmt.where(Job.recording_id == recording_id)

    total = session.exec(count_stmt).one()
    items = session.exec(
        stmt.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    job = session.get(Job, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job
