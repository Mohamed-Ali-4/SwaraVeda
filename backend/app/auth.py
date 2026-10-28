from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models import Contributor

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_context.verify(raw, hashed)


def create_token(user_id: UUID, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    session: Session = Depends(get_session),
) -> Contributor:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = UUID(payload.get("sub"))
    except (JWTError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = session.exec(select(Contributor).where(Contributor.id == user_id)).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_verifier(user: Contributor = Depends(current_user)) -> Contributor:
    if user.role not in ("verifier", "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Verifier role required")
    return user


def require_admin(user: Contributor = Depends(current_user)) -> Contributor:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")
    return user


def promote_if_configured_admin(user: Contributor, session: Session) -> None:
    """Emails in ADMIN_EMAILS become admin on register or login, which is how
    the first admin is created."""
    if user.email.lower() in settings.admin_emails and user.role != "admin":
        user.role = "admin"
        session.add(user)
        session.commit()
        session.refresh(user)
