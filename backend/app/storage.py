"""Supabase Storage helpers. Audio goes browser -> Supabase directly,
never through this API, so free-tier memory limits are never hit."""
from supabase import create_client
from app.config import settings

_client = None


def client():
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def create_signed_upload(path: str) -> dict:
    res = client().storage.from_(settings.SUPABASE_BUCKET).create_signed_upload_url(path)
    return {"url": res.get("signed_url") or res.get("signedURL"), "token": res.get("token")}


def public_url(path: str) -> str:
    return client().storage.from_(settings.SUPABASE_BUCKET).get_public_url(path)
