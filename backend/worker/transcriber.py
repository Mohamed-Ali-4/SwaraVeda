import logging
from pathlib import Path

from faster_whisper import WhisperModel

from worker.config import settings

logger = logging.getLogger(__name__)
_model = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        logger.info(
            "Loading Whisper model=%s device=%s compute=%s",
            settings.WHISPER_MODEL, settings.WHISPER_DEVICE, settings.WHISPER_COMPUTE_TYPE,
        )
        _model = WhisperModel(
            settings.WHISPER_MODEL,
            device=settings.WHISPER_DEVICE,
            compute_type=settings.WHISPER_COMPUTE_TYPE,
        )
        logger.info("Whisper model loaded")
    return _model


def transcribe(audio_path: Path) -> list[dict]:
    model = _get_model()
    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
    )
    logger.info(
        "Detected language: %s (prob=%.2f), duration=%.1fs",
        info.language, info.language_probability, info.duration,
    )

    segments = []
    for i, seg in enumerate(segments_iter):
        segments.append({
            "seq": i + 1,
            "start_ms": int(seg.start * 1000),
            "end_ms": int(seg.end * 1000),
            "asr_text": seg.text.strip(),
        })
        logger.debug("Segment %d: [%d-%d ms] %s", i + 1, int(seg.start * 1000), int(seg.end * 1000), seg.text.strip())

    logger.info("Transcription complete: %d segments", len(segments))
    return segments
