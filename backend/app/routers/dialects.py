from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func

from app.db import get_session
from app.models import Dialect, Contributor, Recording
from app.schemas import DialectIn, DialectOut, DialectPatch
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
