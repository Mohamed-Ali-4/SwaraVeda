from contextlib import contextmanager
from uuid import UUID

import pytest
from sqlmodel import Session

from app import audio, nlp, pipeline
from app.config import settings
from app.models import Recording, Segment


@pytest.fixture
def recording_id(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={
        "name": "Tulu", "script": "kannada", "asr_language": "kn",
    })
    dialect_id = resp.json()["id"]
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Paddana", "dialect_id": dialect_id,
        "audio_url": "https://example.com/paddana.webm",
        "consent_public": True,
    })
    return UUID(resp.json()["id"])


@pytest.fixture
def hosted_nlp(monkeypatch, session: Session, tmp_path):
    """Turns on hosted NLP with the network calls replaced by fakes."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")

    @contextmanager
    def shared_session():
        yield session

    monkeypatch.setattr(pipeline, "new_session", shared_session)
    fake = tmp_path / "paddana.ogg"
    fake.write_bytes(b"audio")
    monkeypatch.setattr(pipeline, "_prepare_audio",
                        lambda rec, workdir: audio.Prepared(fake, None, False))
    calls = {}

    def fake_transcribe(audio, filename, language=None):
        calls["language"] = language
        return [
            {"seq": 1, "start_ms": 0, "end_ms": 2000, "asr_text": "first line"},
            {"seq": 2, "start_ms": 2000, "end_ms": 4500, "asr_text": "second line"},
        ], 4.5

    monkeypatch.setattr(nlp, "transcribe_audio", fake_transcribe)
    return calls


def test_nlp_status_off_by_default(client):
    assert client.get("/nlp/status").json() == {
        "transcription": False, "translation": False, "semantic_search": False,
    }


def test_transcribe_without_hosted_nlp_waits_for_worker(client, auth_headers, recording_id):
    resp = client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_transcribe_again_returns_active_job(client, auth_headers, recording_id):
    first = client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers).json()
    second = client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers).json()
    assert first["id"] == second["id"]


def test_hosted_transcription_saves_segments(client, auth_headers, recording_id, hosted_nlp):
    resp = client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers)
    assert resp.status_code == 200

    detail = client.get(f"/recordings/{recording_id}").json()
    assert detail["recording"]["status"] == "transcribed"
    assert detail["recording"]["duration_seconds"] == 4.5
    assert [s["asr_text"] for s in detail["segments"]] == ["first line", "second line"]
    assert detail["latest_job"]["status"] == "completed"
    assert detail["latest_job"]["progress"] == 100
    # The dialect's language hint is passed to Whisper.
    assert hosted_nlp["language"] == "kn"


@pytest.mark.skipif(not audio.available(), reason="ffmpeg not installed")
def test_pipeline_preprocesses_real_audio(client, auth_headers, recording_id, session, monkeypatch, tmp_path):
    """Download → ffmpeg → transcription service, with only the network faked."""
    import subprocess
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")

    @contextmanager
    def shared_session():
        yield session

    def fake_download(rec, workdir):
        path = workdir / "field-recording.wav"
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-f", "lavfi",
                        "-i", "sine=frequency=300:duration=5", "-ac", "2", str(path)], check=True)
        return path

    sent = {}

    def fake_transcribe(data, filename, language=None):
        sent.update(size=len(data), filename=filename)
        return [{"seq": 1, "start_ms": 0, "end_ms": 5000, "asr_text": "tone"}], None

    monkeypatch.setattr(pipeline, "new_session", shared_session)
    monkeypatch.setattr(pipeline, "_download", fake_download)
    monkeypatch.setattr(nlp, "transcribe_audio", fake_transcribe)

    client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers)
    detail = client.get(f"/recordings/{recording_id}").json()
    assert detail["latest_job"]["status"] == "completed", detail["latest_job"]
    assert sent["filename"] == "field-recording-speech.ogg"
    assert 0 < sent["size"] < 60_000
    # Duration comes from the audio itself when the service doesn't report it.
    assert detail["recording"]["duration_seconds"] == pytest.approx(5.0, abs=0.1)


def test_hosted_transcription_failure_is_reported(client, auth_headers, recording_id, hosted_nlp, monkeypatch):
    def broken(*args, **kwargs):
        raise nlp.NLPError("Transcription service returned 429: rate limited")

    monkeypatch.setattr(nlp, "transcribe_audio", broken)
    client.post(f"/recordings/{recording_id}/transcribe", headers=auth_headers)

    detail = client.get(f"/recordings/{recording_id}").json()
    assert detail["recording"]["status"] == "uploaded"
    assert detail["latest_job"]["status"] == "failed"
    assert "rate limited" in detail["latest_job"]["error"]


def test_translate_needs_groq(client, auth_headers, recording_id, session):
    seg = Segment(recording_id=recording_id, seq=1, start_ms=0, end_ms=1000, asr_text="namaskara")
    session.add(seg)
    session.commit()
    resp = client.post(f"/segments/{seg.id}/translate", headers=auth_headers)
    assert resp.status_code == 503


def test_translate_returns_suggestion(client, auth_headers, recording_id, session, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-key")
    seen = {}

    def fake_translate(text, dialect=None, script=None):
        seen.update(text=text, dialect=dialect, script=script)
        return {"translation_en": "greetings", "transliteration": "namaskāra"}

    monkeypatch.setattr(nlp, "translate_text", fake_translate)
    seg = Segment(recording_id=recording_id, seq=1, start_ms=0, end_ms=1000,
                  asr_text="namaskra", corrected_text="namaskara")
    session.add(seg)
    session.commit()

    resp = client.post(f"/segments/{seg.id}/translate", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["translation_en"] == "greetings"
    # Translates the corrected text, with the dialect as context.
    assert seen == {"text": "namaskara", "dialect": "Tulu", "script": "kannada"}

    # Unsaved text from the editor takes precedence.
    client.post(f"/segments/{seg.id}/translate", headers=auth_headers, json={"text": "draft"})
    assert seen["text"] == "draft"
    # Suggestions aren't saved until the user confirms.
    session.refresh(seg)
    assert seg.translation_en is None


def test_semantic_search_without_embeddings_is_503(client):
    resp = client.get("/search/semantic?q=harvest")
    assert resp.status_code == 503


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status
        self.is_success = status < 400
        self.text = str(payload)

    def json(self):
        return self._payload


def test_transcribe_audio_parses_groq_segments(monkeypatch):
    sent = {}

    def fake_post(url, **kwargs):
        sent.update(url=url, data=kwargs["data"])
        return FakeResponse({
            "language": "kannada", "duration": 3.2, "text": "a b",
            "segments": [
                {"start": 0.0, "end": 1.5, "text": " a "},
                {"start": 1.5, "end": 2.0, "text": "  "},
                {"start": 2.0, "end": 3.2, "text": "b"},
            ],
        })

    monkeypatch.setattr(nlp.httpx, "post", fake_post)
    segments, duration = nlp.transcribe_audio(b"x", "a.webm", "kn")
    assert sent["url"].endswith("/audio/transcriptions")
    assert sent["data"]["language"] == "kn"
    assert duration == 3.2
    assert segments == [
        {"seq": 1, "start_ms": 0, "end_ms": 1500, "asr_text": "a"},
        {"seq": 2, "start_ms": 2000, "end_ms": 3200, "asr_text": "b"},
    ]


def test_service_errors_carry_the_message(monkeypatch):
    monkeypatch.setattr(nlp.httpx, "post", lambda url, **kw: FakeResponse(
        {"error": {"message": "Invalid API Key"}}, status=401))
    with pytest.raises(nlp.NLPError, match="Invalid API Key"):
        nlp.transcribe_audio(b"x", "a.webm")


def test_embeddings_are_pooled_and_normalized(monkeypatch):
    monkeypatch.setattr(nlp.httpx, "post", lambda url, **kw: FakeResponse([
        [3.0, 4.0],                  # sentence vector
        [[1.0, 0.0], [3.0, 0.0]],    # token vectors, mean-pooled to [2, 0]
    ]))
    assert nlp.embed_texts(["a", "b"]) == [[0.6, 0.8], [1.0, 0.0]]


def test_translate_text_parses_json(monkeypatch):
    monkeypatch.setattr(nlp.httpx, "post", lambda url, **kw: FakeResponse({
        "choices": [{"message": {"content": '{"translation_en": " Hello ", "transliteration": ""}'}}],
    }))
    assert nlp.translate_text("namaskara", "Tulu") == {
        "translation_en": "Hello", "transliteration": None,
    }


def test_download_identifies_itself(monkeypatch, tmp_path):
    # Wikimedia and other archives refuse downloads that carry no User-Agent.
    seen = {}

    class FakeStream:
        status_code = 200

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def iter_bytes(self):
            yield b"audio"

    def fake_stream(method, url, **kw):
        seen.update(kw.get("headers") or {})
        return FakeStream()

    monkeypatch.setattr(pipeline.httpx, "stream", fake_stream)
    rec = Recording(title="Ref", audio_url="https://upload.wikimedia.org/a/b/Ref.ogg")
    path = pipeline._download(rec, tmp_path)
    assert path.read_bytes() == b"audio"
    assert seen.get("User-Agent", "").startswith("SwaraVeda/")
