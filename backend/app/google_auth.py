"""Verifies Google Identity Services ID tokens without extra dependencies:
the token's RS256 signature is checked against Google's published keys."""
import time

import httpx
from jose import jwt, JWTError

from app.config import settings

CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
ISSUERS = ("accounts.google.com", "https://accounts.google.com")
_cache: dict = {"keys": None, "at": 0.0}


class GoogleAuthError(Exception):
    pass


def enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID)


def _google_keys() -> dict:
    if not _cache["keys"] or time.time() - _cache["at"] > 3600:
        resp = httpx.get(CERTS_URL, timeout=10)
        resp.raise_for_status()
        _cache.update(keys=resp.json(), at=time.time())
    return _cache["keys"]


def verify(credential: str) -> dict:
    """Returns the token's claims (email, name, sub...) or raises."""
    try:
        claims = jwt.decode(
            credential, _google_keys(), algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID, issuer=ISSUERS,
            options={"verify_at_hash": False},
        )
    except (JWTError, httpx.HTTPError) as e:
        raise GoogleAuthError(f"Google sign-in could not be verified: {e}")
    if not claims.get("email") or not claims.get("email_verified"):
        raise GoogleAuthError("This Google account has no verified email address")
    return claims
