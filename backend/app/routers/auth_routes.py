from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import Contributor
from app.schemas import (
    RegisterIn, LoginIn, TokenOut, ProfileOut, ProfilePatch, ChangePasswordIn,
)
from app.auth import (
    hash_password, verify_password, create_token, current_user,
    promote_if_configured_admin,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, session: Session = Depends(get_session)):
    existing = session.exec(select(Contributor).where(Contributor.email == body.email)).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = Contributor(
        display_name=body.display_name,
        email=body.email,
        password_hash=hash_password(body.password),
        native_dialect=body.native_dialect,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    promote_if_configured_admin(user, session)
    return TokenOut(
        access_token=create_token(user.id, user.role),
        display_name=user.display_name,
        role=user.role,
    )


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(get_session)):
    user = session.exec(select(Contributor).where(Contributor.email == body.email)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    promote_if_configured_admin(user, session)
    return TokenOut(
        access_token=create_token(user.id, user.role),
        display_name=user.display_name,
        role=user.role,
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(user: Contributor = Depends(current_user)):
    return TokenOut(
        access_token=create_token(user.id, user.role),
        display_name=user.display_name,
        role=user.role,
    )


@router.get("/me", response_model=ProfileOut)
def me(user: Contributor = Depends(current_user)):
    return user


@router.patch("/me", response_model=ProfileOut)
def update_profile(
    body: ProfilePatch,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordIn,
    session: Session = Depends(get_session),
    user: Contributor = Depends(current_user),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    session.add(user)
    session.commit()
