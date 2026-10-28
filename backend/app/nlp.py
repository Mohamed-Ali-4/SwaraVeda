"""Hosted NLP: transcription and translation via Groq, embeddings via Hugging
Face Inference. Nothing is loaded into memory, so the full pipeline runs on a
free-tier server."""
import json
import logging
import math

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

class NLPError(RuntimeError):
    pass


def transcription_enabled() -> bool:
    return bool(settings.GROQ_API_KEY)


def translation_enabled() -> bool:
    return bool(settings.GROQ_API_KEY)


def embeddings_enabled() -> bool:
    return bool(settings.HF_TOKEN)


def _groq_headers() -> dict:
    return {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}


def _raise_for(resp: httpx.Response, service: str) -> None:
    if resp.is_success:
        return
    try:
        detail = resp.json().get("error", {})
        detail = detail.get("message") if isinstance(detail, dict) else detail
    except ValueError:
        detail = resp.text[:200]
    raise NLPError(f"{service} returned {resp.status_code}: {detail}")


def transcribe_audio(audio: bytes, filename: str, language: str | None = None) -> tuple[list[dict], float | None]:
    """Returns (segments, duration_seconds). Segments carry seq, start_ms,
    end_ms and asr_text, the same shape the local worker produces."""
    data = {
        "model": settings.GROQ_ASR_MODEL,
        "response_format": "verbose_json",
        "temperature": "0",
    }
    if language:
        data["language"] = language
    resp = httpx.post(
        f"{settings.GROQ_BASE_URL.rstrip('/')}/audio/transcriptions",
        headers=_groq_headers(),
        data=data,
        files={"file": (filename, audio)},
        timeout=300,
    )
    _raise_for(resp, "Transcription service")
    body = resp.json()

    segments = []
    for seg in body.get("segments") or []:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        segments.append({
            "seq": len(segments) + 1,
            "start_ms": int(seg["start"] * 1000),
            "end_ms": int(seg["end"] * 1000),
            "asr_text": text,
        })
    duration = body.get("duration")
    if not segments and (body.get("text") or "").strip():
        segments.append({
            "seq": 1,
            "start_ms": 0,
            "end_ms": int((duration or 0) * 1000),
            "asr_text": body["text"].strip(),
        })
    logger.info("Transcribed %d segments (language=%s)", len(segments), body.get("language"))
    return segments, duration


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _sentence_vector(item) -> list[float]:
    # Sentence-transformer models return one vector per input; plain
    # transformer models return one per token, which we mean-pool.
    if item and isinstance(item[0], list):
        dim = len(item[0])
        return [sum(tok[i] for tok in item) / len(item) for i in range(dim)]
    return item


def embed_texts(texts: list[str]) -> list[list[float]]:
    url = f"{settings.HF_INFERENCE_URL}/models/{settings.EMBEDDING_MODEL}/pipeline/feature-extraction"
    vectors: list[list[float]] = []
    for i in range(0, len(texts), 32):
        batch = texts[i:i + 32]
        resp = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.HF_TOKEN}"},
            json={"inputs": batch},
            timeout=60,
        )
        _raise_for(resp, "Embedding service")
        vectors.extend(_normalize(_sentence_vector(v)) for v in resp.json())
    return vectors


TRANSLATE_PROMPT = """You help archive endangered Indian dialects. Translate the
transcribed speech below into natural English, and transliterate it into Latin
script (ISO 15919 style, no diacritics needed). The text may be a dialect of
{dialect}{script} and may contain transcription errors; translate the most
likely meaning. Reply with JSON only: {{"translation_en": "...", "transliteration": "..."}}"""


def translate_text(text: str, dialect: str | None = None, script: str | None = None) -> dict:
    system = TRANSLATE_PROMPT.format(
        dialect=dialect or "an Indian language",
        script=f" written in {script} script" if script else "",
    )
    resp = httpx.post(
        f"{settings.GROQ_BASE_URL.rstrip('/')}/chat/completions",
        headers=_groq_headers(),
        json={
            "model": settings.GROQ_LLM_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        },
        timeout=60,
    )
    _raise_for(resp, "Translation service")
    content = resp.json()["choices"][0]["message"]["content"]
    try:
        out = json.loads(content)
    except ValueError:
        raise NLPError("Translation service returned an unreadable answer")
    return {
        "translation_en": (out.get("translation_en") or "").strip() or None,
        "transliteration": (out.get("transliteration") or "").strip() or None,
    }
