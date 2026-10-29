"""Find openly licensed audio of a dialect on Wikimedia Commons, so verifiers
can add real reference recordings (folk songs, stories, spoken words) with
their licence and credit."""
import re
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.auth import require_verifier
from app.db import get_session
from app.models import Contributor, Dialect, Recording

router = APIRouter(prefix="/references", tags=["references"])

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia asks every client to identify itself.
USER_AGENT = "SwaraVeda/1.0 (community archive of endangered Indian dialects; https://swara-veda.vercel.app)"


def open_licence(name: str) -> bool:
    """Licences that let anyone share the clip: public domain, CC0, CC BY, CC BY-SA. No NC or ND."""
    n = name.lower().replace("-", " ")
    if " nc" in n or " nd" in n or "noncommercial" in n:
        return False
    return n.startswith(("cc0", "public domain", "pd", "cc by", "cc zero"))


def _text(html: Optional[str]) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def commons_audio(search: str, limit: int) -> list[dict]:
    """Audio files on Commons matching `search`, with licence and author."""
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "search", "gsrsearch": f"{search} filetype:audio", "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|mime|extmetadata",
        "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription",
    }
    resp = httpx.get(COMMONS_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=20)
    resp.raise_for_status()
    found = []
    for page in resp.json().get("query", {}).get("pages", []):
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        licence = _text((meta.get("LicenseShortName") or {}).get("value"))
        mime = info.get("mime", "")
        if not info.get("url") or not (mime.startswith("audio/") or mime in ("application/ogg", "video/webm")):
            continue
        title = page.get("title", "").removeprefix("File:")
        found.append({
            "title": re.sub(r"\.(ogg|oga|opus|mp3|wav|flac|webm)$", "", title, flags=re.I),
            "audio_url": info["url"],
            "page_url": info.get("descriptionurl"),
            "licence": licence,
            "open_licence": open_licence(licence),
            "author": _text((meta.get("Artist") or {}).get("value"))[:120],
            "description": _text((meta.get("ImageDescription") or {}).get("value"))[:240],
            # Lingua Libre names its files "LL-Q… (iso)-Speaker-word": a native speaker saying one word.
            "word": title.rsplit("-", 1)[-1].rsplit(".", 1)[0] if title.startswith("LL-") else None,
        })
    return found


@router.get("/commons")
def search_commons(
    dialect_id: UUID,
    limit: int = Query(12, ge=1, le=30),
    session: Session = Depends(get_session),
    user: Contributor = Depends(require_verifier),
):
    d = session.get(Dialect, dialect_id)
    if not d:
        raise HTTPException(404, "Dialect not found")
    searches = []
    if d.iso_code:
        searches.append(f'intitle:"({d.iso_code})"')  # Lingua Libre words in this language
    searches.append(f'"{d.name}"')
    results, seen = [], set()
    try:
        for s in searches:
            for r in commons_audio(s, limit):
                if r["audio_url"] not in seen:
                    seen.add(r["audio_url"])
                    results.append(r)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Couldn't reach Wikimedia Commons: {type(e).__name__}")
    added = set(session.exec(select(Recording.audio_url).where(Recording.audio_url.in_(list(seen) or [""]))).all())
    for r in results:
        r["already_added"] = r["audio_url"] in added
    return {"dialect": d.name, "results": results[: limit * 2]}
