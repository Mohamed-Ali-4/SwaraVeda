import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from app import google_auth
from app.phone import normalize_phone

from app.db import get_session
from app.models import Contributor
from app.schemas import (
    RegisterIn, LoginIn, GoogleLoginIn, TokenOut, ProfileOut, ProfilePatch, ChangePasswordIn,
)
from app.auth import (
    hash_password, verify_password, create_token, current_user,
    promote_if_configured_admin,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _by_email(session: Session, email: str):
    return session.exec(select(Contributor).where(func.lower(Contributor.email) == email.strip().lower())).first()


def _by_phone(session: Session, phone: str):
    return session.exec(select(Contributor).where(Contributor.phone == phone)).first()


def _token(user: Contributor, session: Session) -> TokenOut:
    promote_if_configured_admin(user, session)
    return TokenOut(
        access_token=create_token(user.id, user.role),
        display_name=user.display_name,
        role=user.role,
    )


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, session: Session = Depends(get_session)):
    if _by_email(session, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if body.phone and _by_phone(session, body.phone):
        raise HTTPException(status.HTTP_409_CONFLICT, "Mobile number already registered")

    user = Contributor(
        display_name=body.display_name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        native_dialect=body.native_dialect,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _token(user, session)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, session: Session = Depends(get_session)):
    """Sign in with an email address or a mobile number."""
    ident = body.email.strip()
    user = None
    if "@" in ident:
        user = _by_email(session, ident)
    else:
        try:
            user = _by_phone(session, normalize_phone(ident))
        except ValueError:
            pass
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email, mobile number or password")
    return _token(user, session)


@router.post("/google", response_model=TokenOut)
def google_login(body: GoogleLoginIn, session: Session = Depends(get_session)):
    """Signs in with a Google ID token, creating the account on first use."""
    if not google_auth.enabled():
        raise HTTPException(503, "Google sign-in isn't set up on this server (GOOGLE_CLIENT_ID is missing).")
    try:
        claims = google_auth.verify(body.credential)
    except google_auth.GoogleAuthError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(e))
    user = _by_email(session, claims["email"])
    if not user:
        user = Contributor(
            display_name=(claims.get("name") or claims["email"].split("@")[0])[:80],
            email=claims["email"],
            # No password: this account signs in with Google until one is set.
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
    return _token(user, session)


@router.get("/config")
def auth_config():
    """Sign-in options the login page should offer."""
    return {"google_client_id": google_auth.settings.GOOGLE_CLIENT_ID or None}


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
    changes = body.model_dump(exclude_unset=True)
    if changes.get("phone"):
        other = _by_phone(session, changes["phone"])
        if other and other.id != user.id:
            raise HTTPException(status.HTTP_409_CONFLICT, "Mobile number already registered")
    for k, v in changes.items():
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
