from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Dialect, Contributor
from app.schemas import DialectIn
from app.auth import current_user

router = APIRouter(prefix="/dialects", tags=["dialects"])


@router.get("", response_model=List[Dialect])
def list_dialects(session: Session = Depends(get_session)):
    return session.exec(select(Dialect).order_by(Dialect.name)).all()


@router.get("/{dialect_id}", response_model=Dialect)
def get_dialect(dialect_id: UUID, session: Session = Depends(get_session)):
    d = session.get(Dialect, dialect_id)
    if not d:
        raise HTTPException(404, "Dialect not found")
    return d


@router.post("", response_model=Dialect, status_code=201)
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
