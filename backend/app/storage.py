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


class StorageError(Exception):
    """Storage is misconfigured or unreachable. The message is safe to show:
    the service key is never included."""


def _explain(e: Exception) -> StorageError:
    msg = f"{type(e).__name__}: {e}"
    if settings.SUPABASE_SERVICE_ROLE_KEY:
        msg = msg.replace(settings.SUPABASE_SERVICE_ROLE_KEY, "***")
    return StorageError(msg[:300])


def create_signed_upload(path: str) -> dict:
    try:
        res = client().storage.from_(settings.SUPABASE_BUCKET).create_signed_upload_url(path)
    except Exception as e:
        raise _explain(e) from e
    return {"url": res.get("signed_url") or res.get("signedURL"), "token": res.get("token")}


def public_url(path: str) -> str:
    try:
        return client().storage.from_(settings.SUPABASE_BUCKET).get_public_url(path)
    except Exception as e:
        raise _explain(e) from e


def check() -> str:
    """'ok' when the bucket can be reached with the configured key, else why not."""
    try:
        client().storage.get_bucket(settings.SUPABASE_BUCKET)
        return "ok"
    except Exception as e:
        return str(_explain(e))
