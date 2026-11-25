import json
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app import nlp, proxy_eval
from app.db import get_session
from app.models import Dialect, Contributor, Job, Recording
from app.schemas import (
    DialectEffort, DialectIn, DialectOut, DialectPatch, ProxyEvalIn, ProxyEvalOut,
)
from app.auth import current_user, require_verifier

router = APIRouter(prefix="/dialects", tags=["dialects"])


@router.get("", response_model=List[DialectOut])
def list_dialects(
    session: Session = Depends(get_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    total = session.exec(select(func.count()).select_from(Dialect)).one()
    items = session.exec(
        select(Dialect).order_by(Dialect.name).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return items


@router.get("/effort", response_model=List[DialectEffort])
def correction_effort(
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    """Per dialect, how far Vani's drafts were from the community's corrections
    (character and word error rate over every corrected passage)."""
    return proxy_eval.effort_by_dialect(session)


@router.get("/{dialect_id}", response_model=DialectOut)
def get_dialect(dialect_id: UUID, session: Session = Depends(get_session)):
    d = session.get(Dialect, dialect_id)
    if not d:
        raise HTTPException(404, "Dialect not found")
    return d


@router.post("", response_model=DialectOut, status_code=201)
def create_dialect(
    body: DialectIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    d = Dialect(**body.model_dump())
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.patch("/{dialect_id}", response_model=DialectOut)
def update_dialect(
    dialect_id: UUID,
    body: DialectPatch,
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    d = session.get(Dialect, dialect_id)
    if not d:
        raise HTTPException(404, "Dialect not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    session.add(d)
    session.commit()
    session.refresh(d)
    return d


@router.delete("/{dialect_id}", status_code=204)
def delete_dialect(
    dialect_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    if user.role != "admin":
        raise HTTPException(403, "Admin role required")
    d = session.get(Dialect, dialect_id)
    if not d:
        raise HTTPException(404, "Dialect not found")
    in_use = session.exec(
        select(func.count()).select_from(Recording).where(Recording.dialect_id == dialect_id)
    ).one()
    if in_use:
        raise HTTPException(409, f"{in_use} recording{'s' if in_use != 1 else ''} use this dialect; change them first")
    session.delete(d)
    session.commit()


def _eval_out(job: Job) -> ProxyEvalOut:
    return ProxyEvalOut(
        id=job.id, dialect_id=job.dialect_id, status=job.status, progress=job.progress, error=job.error,
        result=json.loads(job.result) if job.result else None, created_at=job.created_at, updated_at=job.updated_at,
    )


def _latest_eval(session: Session, dialect_id: UUID) -> Optional[Job]:
    return session.exec(
        select(Job).where(Job.dialect_id == dialect_id, Job.kind == "proxy_eval")
        .order_by(Job.created_at.desc())
    ).first()


@router.post("/{dialect_id}/proxy-eval", response_model=ProxyEvalOut, status_code=202)
def start_proxy_eval(
    dialect_id: UUID,
    body: ProxyEvalIn,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    """Re-transcribe a sample of corrected passages with each candidate language
    and score them against the corrections, to find the best proxy."""
    if not session.get(Dialect, dialect_id):
        raise HTTPException(404, "Dialect not found")
    if not nlp.transcription_enabled():
        raise HTTPException(503, "Transcription isn't switched on, so languages can't be compared yet.")
    candidates = list(dict.fromkeys(c.strip().lower() for c in body.candidates if c.strip()))
    unknown = [c for c in candidates if c != proxy_eval.AUTO and c not in proxy_eval.LANGUAGES]
    if unknown:
        raise HTTPException(400, f"Unknown language code: {', '.join(unknown)}")
    if not candidates or len(candidates) > proxy_eval.MAX_CANDIDATES + 1:
        raise HTTPException(400, f"Choose between 1 and {proxy_eval.MAX_CANDIDATES} languages to compare.")
    latest = _latest_eval(session, dialect_id)
    if latest and latest.status in ("queued", "running"):
        return _eval_out(latest)
    if not proxy_eval.evaluation_sample(session, dialect_id, 1, "check", body.verified_only):
        if body.verified_only:
            raise HTTPException(400, "Verify at least one corrected passage of this dialect first.")
        raise HTTPException(400, "Correct at least one passage of this dialect first: its corrections are the yardstick.")
    job = Job(dialect_id=dialect_id, kind="proxy_eval", status="queued")
    session.add(job)
    session.commit()
    session.refresh(job)
    background.add_task(proxy_eval.run_evaluation, job.id, candidates, min(body.sample, proxy_eval.MAX_SAMPLE),
                        body.verified_only)
    return _eval_out(job)


@router.get("/{dialect_id}/proxy-eval", response_model=Optional[ProxyEvalOut])
def latest_proxy_eval(
    dialect_id: UUID,
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    job = _latest_eval(session, dialect_id)
    return _eval_out(job) if job else None
