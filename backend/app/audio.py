"""Audio pre-processing before speech recognition.

Field recordings arrive as phone videos, WhatsApp voice notes, WAV files
from recorders: different formats, sample rates and loudness. Before
transcription every file is converted to 16 kHz mono (what Whisper works at
internally), low-frequency rumble (wind, handling noise, fans) is filtered
out, and loudness is normalised so a quiet elderly speaker and a loud singer
are transcribed alike. The result is encoded as Opus, which also keeps long
recordings under the transcription service's upload limit (an hour is about
15 MB).

Nothing is cut, trimmed or time-stretched: segment timestamps must line up
with the original recording that the archive plays back.
"""
import json
import logging
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

FILTERS = "highpass=f=80,loudnorm=I=-18:TP=-2:LRA=11"


class AudioError(RuntimeError):
    pass


@dataclass
class Prepared:
    path: Path
    duration: float | None
    processed: bool


def available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def probe_duration(path: Path) -> float | None:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
            capture_output=True, timeout=60, check=True,
        ).stdout
        return round(float(json.loads(out)["format"]["duration"]), 1)
    except (subprocess.SubprocessError, KeyError, ValueError, OSError):
        return None


def prepare_file(src: Path, workdir: Path) -> Prepared:
    """Returns the speech-ready file. Without ffmpeg the original is used."""
    if not available():
        logger.warning("ffmpeg not installed; transcribing the original file")
        return Prepared(src, None, False)

    out = workdir / f"{src.stem}-speech.ogg"
    cmd = [
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-af", FILTERS,
        "-c:a", "libopus", "-b:a", "32k", str(out),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=900)
    except subprocess.TimeoutExpired:
        raise AudioError("Audio processing took too long; try a shorter recording")
    if result.returncode != 0:
        reason = result.stderr.decode(errors="replace").strip().splitlines()
        raise AudioError(
            "Couldn't read this audio file"
            + (f" ({reason[-1][:150]})" if reason else "")
        )
    duration = probe_duration(src) or probe_duration(out)
    logger.info("Pre-processed %s: %.1f s, %d KB", src.name, duration or 0, out.stat().st_size // 1024)
    return Prepared(out, duration, True)
