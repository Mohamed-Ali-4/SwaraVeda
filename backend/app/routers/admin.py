from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Contributor
from app.schemas import AdminUserOut, RolePatch
from app.auth import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=List[AdminUserOut])
def list_users(
    session: Session = Depends(get_session),
    admin: Contributor = Depends(require_admin),
):
    return session.exec(select(Contributor).order_by(Contributor.created_at)).all()


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def set_role(
    user_id: UUID,
    body: RolePatch,
    session: Session = Depends(get_session),
    admin: Contributor = Depends(require_admin),
):
    user = session.get(Contributor, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id and body.role != "admin":
        raise HTTPException(400, "You can't remove your own admin role")
    user.role = body.role.value
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
