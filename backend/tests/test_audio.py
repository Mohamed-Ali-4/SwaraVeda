import shutil
import subprocess

import pytest

from app import audio

needs_ffmpeg = pytest.mark.skipif(not audio.available(), reason="ffmpeg not installed")


def _tone(path, seconds=3, rate=44100, channels=2):
    subprocess.run([
        "ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "lavfi",
        "-i", f"sine=frequency=440:sample_rate={rate}:duration={seconds}",
        "-ac", str(channels), str(path),
    ], check=True)


@needs_ffmpeg
def test_prepare_converts_to_16k_mono_opus(tmp_path):
    src = tmp_path / "field.wav"
    _tone(src, seconds=3)
    prepared = audio.prepare_file(src, tmp_path)

    assert prepared.processed
    assert prepared.path.suffix == ".ogg"
    assert prepared.duration == pytest.approx(3.0, abs=0.1)
    info = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,sample_rate,channels",
         "-of", "csv=p=0", str(prepared.path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    assert info == "opus,48000,1" or info == "opus,16000,1"
    # Much smaller than the 44.1 kHz stereo WAV.
    assert prepared.path.stat().st_size < src.stat().st_size / 5


@needs_ffmpeg
def test_prepare_keeps_timing(tmp_path):
    """Pre-processing must not trim or stretch: timestamps refer to the original."""
    src = tmp_path / "long.mp3"
    _tone(src, seconds=7)
    prepared = audio.prepare_file(src, tmp_path)
    assert audio.probe_duration(prepared.path) == pytest.approx(7.0, abs=0.15)


@needs_ffmpeg
def test_unreadable_file_gives_clear_error(tmp_path):
    src = tmp_path / "broken.webm"
    src.write_bytes(b"not audio at all")
    with pytest.raises(audio.AudioError, match="Couldn't read this audio file"):
        audio.prepare_file(src, tmp_path)


def test_without_ffmpeg_the_original_is_used(tmp_path, monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda name: None)
    src = tmp_path / "a.webm"
    src.write_bytes(b"x")
    prepared = audio.prepare_file(src, tmp_path)
    assert prepared.path == src and not prepared.processed
