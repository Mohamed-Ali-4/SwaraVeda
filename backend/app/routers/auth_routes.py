from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import Contributor
from app.schemas import RegisterIn, LoginIn, TokenOut
from app.auth import hash_password, verify_password, create_token, current_user

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
    return TokenOut(
        access_token=create_token(user.id, user.role),
        display_name=user.display_name,
        role=user.role,
    )


@router.get("/me")
def me(user: Contributor = Depends(current_user)):
    return {
        "id": user.id,
        "display_name": user.display_name,
        "email": user.email,
        "role": user.role,
        "native_dialect": user.native_dialect,
    }
