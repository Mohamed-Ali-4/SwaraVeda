"""Choosing each dialect's proxy language from correction effort.

Vani transcribes a dialect Whisper does not know *as if* it were a related
language it does know (Tulu as Kannada, Beary as Malayalam...). Every passage
a native speaker corrects tells us how far that draft was from the truth, so
the archive already holds the measurement needed to pick the best proxy:

- `effort_by_dialect` reports, per dialect, the character and word error
  rate between Vani's drafts and the human corrections (no extra labelling).
- `run_evaluation` re-transcribes a sample of corrected passages with each
  candidate language, scores every candidate the same way, and names the one
  with the least correction effort.
"""
import json
import logging
import random
import subprocess
import tempfile
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from uuid import UUID

from sqlmodel import Session, select

from app import audio, nlp
from app.db import new_session
from app.models import Dialect, Job, Recording, Segment

logger = logging.getLogger(__name__)

# Whisper language codes worth trying as proxies for Indian dialects.
LANGUAGES = {
    "kn": "Kannada", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam", "hi": "Hindi",
    "mr": "Marathi", "bn": "Bengali", "gu": "Gujarati", "pa": "Punjabi", "ur": "Urdu",
    "ne": "Nepali", "as": "Assamese", "si": "Sinhala", "sa": "Sanskrit", "en": "English",
}
AUTO = "auto"  # let Whisper identify the language itself: the no-hint baseline
MAX_CANDIDATES = 4
MAX_SAMPLE = 30


# ──── measuring correction effort ────

def normalise(text: str | None) -> str:
    """NFC, lower case, punctuation removed, spaces collapsed, so effort counts
    words and letters rather than commas."""
    text = unicodedata.normalize("NFC", text or "").lower()
    text = "".join(" " if unicodedata.category(c).startswith("P") else c for c in text)
    return " ".join(text.split())


def edit_distance(a: Sequence, b: Sequence) -> int:
    """Levenshtein distance: insertions, deletions and substitutions."""
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


class Tally:
    """Micro-averaged error rates: total edits over total reference length."""

    def __init__(self):
        self.char_edits = self.chars = self.word_edits = self.words = self.passages = 0

    def add(self, draft: str | None, truth: str | None) -> None:
        hyp, ref = normalise(draft), normalise(truth)
        if not ref:
            return
        self.char_edits += edit_distance(hyp, ref)
        self.chars += len(ref)
        self.word_edits += edit_distance(hyp.split(), ref.split())
        self.words += len(ref.split())
        self.passages += 1

    @property
    def cer(self) -> float | None:
        return round(self.char_edits / self.chars, 4) if self.chars else None

    @property
    def wer(self) -> float | None:
        return round(self.word_edits / self.words, 4) if self.words else None


def corrected(stmt):
    return stmt.where(Segment.corrected_text != None, Segment.corrected_text != "")  # noqa: E711


def effort_by_dialect(session: Session) -> list[dict]:
    """How much the community had to correct Vani's drafts, per dialect."""
    rows = session.exec(corrected(
        select(Segment, Recording.dialect_id).join(Recording, Recording.id == Segment.recording_id)
        .where(Recording.dialect_id != None, Segment.asr_text != None)  # noqa: E711
    )).all()
    tallies: dict[UUID, Tally] = defaultdict(Tally)
    verified: dict[UUID, int] = defaultdict(int)
    for seg, dialect_id in rows:
        tallies[dialect_id].add(seg.asr_text, seg.corrected_text)
        verified[dialect_id] += seg.verified_at is not None
    out = []
    for dialect_id, t in tallies.items():
        if not t.passages:
            continue
        d = session.get(Dialect, dialect_id)
        out.append({
            "dialect_id": dialect_id, "name": d.name if d else "Unknown",
            "asr_language": d.asr_language if d else None,
            "passages": t.passages, "verified": verified[dialect_id],
            "cer": t.cer, "wer": t.wer,
        })
    return sorted(out, key=lambda r: (-r["passages"], r["name"]))


# ──── comparing candidate proxies ────

def evaluation_sample(session: Session, dialect_id: UUID, size: int, seed: str) -> list[tuple[Segment, Recording]]:
    """Corrected passages of the dialect that have audio, verified ones first."""
    rows = session.exec(corrected(
        select(Segment, Recording).join(Recording, Recording.id == Segment.recording_id)
        .where(Recording.dialect_id == dialect_id, Segment.end_ms > Segment.start_ms)
        .where((Recording.audio_url != None) | (Recording.storage_path != None))  # noqa: E711
    )).all()
    verified = [r for r in rows if r[0].verified_at is not None]
    others = [r for r in rows if r[0].verified_at is None]
    rng = random.Random(seed)
    rng.shuffle(verified)
    rng.shuffle(others)
    return (verified + others)[:size]


def cut_clip(src: Path, start_ms: int, end_ms: int, dest: Path) -> Path:
    """One passage as 16 kHz mono speech audio, cleaned like a full recording."""
    cmd = [
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", f"{start_ms / 1000:.3f}", "-to", f"{end_ms / 1000:.3f}", "-i", str(src),
        "-vn", "-ac", "1", "-ar", "16000", "-af", audio.FILTERS, "-c:a", "libopus", "-b:a", "32k", str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=300, check=False)
    if result.returncode != 0 or not dest.exists():
        raise nlp.NLPError("Couldn't cut a passage out of the recording")
    return dest


def transcribe_clip(path: Path, language: str | None, retries: int = 5) -> str:
    """Whisper on one clip; waits and retries when the service rate-limits us."""
    for attempt in range(retries):
        try:
            segments, _ = nlp.transcribe_audio(path.read_bytes(), path.name, language)
            return " ".join(s["asr_text"] for s in segments)
        except nlp.NLPError as e:
            if "429" not in str(e) or attempt == retries - 1:
                raise
            time.sleep(15 * (attempt + 1))
    return ""


def _update(session: Session, job: Job, **fields) -> None:
    for k, v in fields.items():
        setattr(job, k, v)
    job.updated_at = datetime.now(timezone.utc)
    session.add(job)
    session.commit()


def run_evaluation(job_id: UUID, candidates: list[str], sample_size: int) -> None:
    from app.pipeline import _download  # the same streamed, size-limited download transcription uses

    with new_session() as session:
        job = session.get(Job, job_id)
        if not job:
            return
        try:
            _update(session, job, status="running", progress=2, error=None)
            sample = evaluation_sample(session, job.dialect_id, sample_size, str(job_id))
            if not sample:
                raise nlp.NLPError("This dialect has no corrected passages with audio yet")
            tallies = {lang: Tally() for lang in candidates}
            total, done = len(sample) * len(candidates), 0
            with tempfile.TemporaryDirectory() as tmp:
                workdir = Path(tmp)
                sources: dict[UUID, Path] = {}
                for k, (seg, rec) in enumerate(sample):
                    if rec.id not in sources:
                        (workdir / str(rec.id)).mkdir()
                        sources[rec.id] = _download(rec, workdir / str(rec.id))
                    clip = cut_clip(sources[rec.id], seg.start_ms, seg.end_ms, workdir / f"clip-{k}.ogg")
                    for lang in candidates:
                        tallies[lang].add(transcribe_clip(clip, None if lang == AUTO else lang), seg.corrected_text)
                        done += 1
                        _update(session, job, progress=min(98, 2 + int(96 * done / total)))
            scored = [
                {"language": lang, "name": LANGUAGES.get(lang, "Detect automatically"), "cer": t.cer, "wer": t.wer,
                 "passages": t.passages}
                for lang, t in tallies.items()
            ]
            ranked = sorted((s for s in scored if s["cer"] is not None), key=lambda s: (s["cer"], s["wer"] or 0))
            result = {"passages": len(sample), "candidates": scored, "best": ranked[0]["language"] if ranked else None}
            _update(session, job, status="completed", progress=100, result=json.dumps(result))
        except Exception as e:
            session.rollback()
            logger.exception("Proxy evaluation %s failed", job_id)
            message = str(e) if isinstance(e, (nlp.NLPError, audio.AudioError)) else "Comparison failed unexpectedly"
            _update(session, job, status="failed", error=message[:500])
