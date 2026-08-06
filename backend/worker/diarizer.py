import logging
from pathlib import Path

from worker.config import settings

logger = logging.getLogger(__name__)
_pipeline = None


def is_available() -> bool:
    if not settings.DIARIZATION_ENABLED:
        return False
    if not settings.HF_TOKEN:
        logger.warning("Diarization enabled but HF_TOKEN not set — skipping")
        return False
    return True


def _get_pipeline():
    global _pipeline
    if _pipeline is None:
        from pyannote.audio import Pipeline
        logger.info("Loading pyannote diarization pipeline")
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=settings.HF_TOKEN,
        )
        if settings.WHISPER_DEVICE != "cpu":
            import torch
            _pipeline.to(torch.device(settings.WHISPER_DEVICE))
        logger.info("Diarization pipeline loaded")
    return _pipeline


def diarize(audio_path: Path, segments: list[dict]) -> list[dict]:
    if not is_available():
        logger.info("Diarization skipped (not enabled)")
        return segments

    pipeline = _get_pipeline()
    diarization = pipeline(str(audio_path))

    speaker_map: list[tuple[float, float, str]] = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_map.append((turn.start * 1000, turn.end * 1000, speaker))

    for seg in segments:
        seg_mid = (seg["start_ms"] + seg["end_ms"]) / 2
        best_speaker = None
        best_overlap = 0

        for d_start, d_end, speaker in speaker_map:
            overlap_start = max(seg["start_ms"], d_start)
            overlap_end = min(seg["end_ms"], d_end)
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker

        if best_speaker:
            seg["speaker_label"] = best_speaker

    labeled = sum(1 for s in segments if s.get("speaker_label"))
    logger.info("Diarization complete: %d/%d segments labeled", labeled, len(segments))
    return segments
