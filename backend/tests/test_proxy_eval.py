import json
from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import UUID

import pytest
from sqlmodel import Session

from app import nlp, pipeline, proxy_eval
from app.config import settings
from app.models import Dialect, Job, Recording, Segment


def test_edit_distance_and_normalisation():
    assert proxy_eval.edit_distance("kitten", "sitting") == 3
    assert proxy_eval.edit_distance("ಮಳೆ", "ಮಳೆ") == 0
    assert proxy_eval.edit_distance("a b c".split(), "a c".split()) == 1
    assert proxy_eval.normalise("  Rain, at the FORT!  ") == "rain at the fort"


def test_tally_is_micro_averaged():
    t = proxy_eval.Tally()
    t.add("abc", "abd")      # 1 edit over 3 characters
    t.add("hello", "hello")  # 0 over 5
    t.add("anything", "")    # no reference: ignored
    assert t.passages == 2
    assert t.cer == round(1 / 8, 4)


@pytest.fixture
def tulu(session: Session):
    """A Tulu recording with three passages: two corrected (one verified), one untouched."""
    d = Dialect(name="Tulu", script="Kannada", asr_language="kn")
    session.add(d)
    session.commit()
    rec = Recording(title="Paddana", dialect_id=d.id, audio_url="https://example.com/p.webm", speaker_name="Kamala Shetty")
    session.add(rec)
    session.commit()
    now = datetime.now(timezone.utc)
    session.add_all([
        Segment(recording_id=rec.id, seq=1, start_ms=0, end_ms=2000, asr_text="ballala kote male",
                corrected_text="ballala koted male", verified_at=now),
        Segment(recording_id=rec.id, seq=2, start_ms=2000, end_ms=4000, asr_text="paddana",
                corrected_text="paddana"),
        Segment(recording_id=rec.id, seq=3, start_ms=4000, end_ms=6000, asr_text="no correction yet"),
    ])
    session.commit()
    return d


def test_effort_needs_a_verifier(client, auth_headers, tulu):
    assert client.get("/dialects/effort", headers=auth_headers).status_code == 403


def test_effort_by_dialect(client, admin_headers, tulu):
    rows = client.get("/dialects/effort", headers=admin_headers).json()
    assert len(rows) == 1
    row = rows[0]
    assert row["name"] == "Tulu" and row["asr_language"] == "kn"
    assert row["passages"] == 2 and row["verified"] == 1
    assert row["recordings"] == 1 and row["speakers"] == 1
    assert row["verified_minutes"] == round(2000 / 60000, 2)  # only the verified 0-2 s passage
    # "ballala kote male" → "ballala koted male" is one inserted letter; "paddana" is exact.
    assert row["cer"] == round(1 / (len("ballala koted male") + len("paddana")), 4)
    assert row["wer"] == round(1 / 4, 4)


@pytest.fixture
def fake_whisper(monkeypatch, session: Session, tmp_path):
    """Kannada drafts are perfect, Malayalam ones are off, auto is worse."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")

    @contextmanager
    def shared_session():
        yield session

    monkeypatch.setattr(proxy_eval, "new_session", shared_session)
    src = tmp_path / "rec.webm"
    src.write_bytes(b"audio")
    monkeypatch.setattr(pipeline, "_download", lambda rec, workdir: src)
    clips = {}

    def fake_cut(src_path, start_ms, end_ms, dest):
        dest.write_bytes(b"clip")
        clips[dest.name] = start_ms
        return dest

    monkeypatch.setattr(proxy_eval, "cut_clip", fake_cut)
    truth = {0: "ballala koted male", 2000: "paddana"}

    def fake_transcribe(data, filename, language=None):
        ref = truth[clips[filename]]
        text = {"kn": ref, "ml": ref.replace("a", "e"), None: "something else entirely"}[language]
        return [{"seq": 1, "start_ms": 0, "end_ms": 1000, "asr_text": text}], 1.0

    monkeypatch.setattr(nlp, "transcribe_audio", fake_transcribe)


def test_comparison_picks_the_proxy_with_least_correction_effort(client, admin_headers, tulu, fake_whisper, session):
    resp = client.post(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers,
                       json={"candidates": ["ml", "kn", "auto"], "sample": 10})
    assert resp.status_code == 202
    job_id = resp.json()["id"]

    latest = client.get(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers).json()
    assert latest["id"] == job_id
    assert latest["status"] == "completed", latest["error"]
    result = latest["result"]
    assert result["passages"] == 2  # only corrected passages are used
    assert result["best"] == "kn"
    scores = {c["language"]: c["cer"] for c in result["candidates"]}
    assert scores["kn"] == 0.0 and scores["ml"] > 0 and scores["auto"] > scores["ml"]
    assert result["recordings"] == 1 and result["speakers"] == 1 and result["verified_only"] is False
    assert result["minutes"] == round(4000 / 60000, 2)
    # Paired comparison with automatic detection, passage by passage.
    vs_auto = {c["language"]: c.get("vs_auto") for c in result["candidates"]}
    assert vs_auto["kn"] == {"better": 2, "worse": 0, "same": 0}
    assert vs_auto["auto"] is None
    stored = session.get(Job, UUID(job_id))
    assert stored.kind == "proxy_eval" and json.loads(stored.result)["best"] == "kn"


def test_comparison_validates_its_input(client, admin_headers, auth_headers, tulu, monkeypatch, session):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    url = f"/dialects/{tulu.id}/proxy-eval"
    assert client.post(url, headers=auth_headers, json={"candidates": ["kn"]}).status_code == 403
    assert client.post(url, headers=admin_headers, json={"candidates": ["xx"]}).status_code == 400
    empty = Dialect(name="Toda", asr_language="ta")
    session.add(empty)
    session.commit()
    resp = client.post(f"/dialects/{empty.id}/proxy-eval", headers=admin_headers, json={"candidates": ["ta"]})
    assert resp.status_code == 400 and "Correct at least one passage" in resp.json()["detail"]


def test_comparison_needs_transcription(client, admin_headers, tulu, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    resp = client.post(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers, json={"candidates": ["kn"]})
    assert resp.status_code == 503


def test_no_comparison_yet_returns_null(client, admin_headers, tulu):
    resp = client.get(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers)
    assert resp.status_code == 200 and resp.json() is None


@pytest.mark.skipif(not proxy_eval.audio.available(), reason="ffmpeg not installed")
def test_cut_clip_extracts_one_passage(tmp_path):
    import subprocess
    src = tmp_path / "tone.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
                    "-ac", "2", "-ar", "44100", str(src)], check=True)
    clip = proxy_eval.cut_clip(src, 1000, 3000, tmp_path / "clip.ogg")
    assert proxy_eval.audio.probe_duration(clip) == pytest.approx(2.0, abs=0.1)


def test_comparison_on_verified_passages_only(client, admin_headers, tulu, fake_whisper):
    resp = client.post(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers,
                       json={"candidates": ["kn", "auto"], "sample": 100, "verified_only": True})
    assert resp.status_code == 202
    result = client.get(f"/dialects/{tulu.id}/proxy-eval", headers=admin_headers).json()["result"]
    assert result["verified_only"] is True and result["passages"] == 1


def test_verified_only_needs_a_verified_passage(client, admin_headers, session, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    d = Dialect(name="Kodava", asr_language="kn")
    session.add(d)
    session.commit()
    rec = Recording(title="Song", dialect_id=d.id, audio_url="https://example.com/s.webm")
    session.add(rec)
    session.commit()
    session.add(Segment(recording_id=rec.id, seq=1, start_ms=0, end_ms=1000, asr_text="a", corrected_text="b"))
    session.commit()
    resp = client.post(f"/dialects/{d.id}/proxy-eval", headers=admin_headers,
                       json={"candidates": ["kn"], "verified_only": True})
    assert resp.status_code == 400 and "Verify at least one" in resp.json()["detail"]
