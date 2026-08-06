import logging
from pathlib import Path

import httpx
from supabase import create_client

from worker.config import settings

logger = logging.getLogger(__name__)
_client = None


def _supabase():
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def download_audio(storage_path: str | None, audio_url: str | None) -> Path:
    dest = Path(settings.TEMP_DIR) / "current_audio"
    dest.parent.mkdir(parents=True, exist_ok=True)

    if storage_path and settings.SUPABASE_URL:
        url = _supabase().storage.from_(settings.SUPABASE_BUCKET).get_public_url(storage_path)
        logger.info("Downloading from Supabase: %s", storage_path)
    elif audio_url:
        url = audio_url
        logger.info("Downloading from URL: %s", audio_url)
    else:
        raise ValueError("No audio source available (no storage_path or audio_url)")

    resp = httpx.get(url, follow_redirects=True, timeout=120)
    resp.raise_for_status()

    ext = storage_path.rsplit(".", 1)[-1] if storage_path and "." in storage_path else "webm"
    out = dest.with_suffix(f".{ext}")
    out.write_bytes(resp.content)
    logger.info("Downloaded %d bytes -> %s", len(resp.content), out)
    return out
