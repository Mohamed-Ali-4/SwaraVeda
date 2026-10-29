import pytest

from app import storage
from app.config import settings

KEY = "sb_secret_do_not_leak_this"


@pytest.fixture(autouse=True)
def secret_key(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_ROLE_KEY", KEY)


class Boom:
    """A storage client whose every call fails the way a bad key does."""

    def __getattr__(self, name):
        raise RuntimeError(f"Invalid API key {settings.SUPABASE_SERVICE_ROLE_KEY}")


def test_upload_url_explains_storage_failure_without_the_key(client, auth_headers, monkeypatch):
    monkeypatch.setattr(storage, "client", lambda: Boom())
    resp = client.post("/recordings/upload-url", json={"filename": "a.webm"}, headers=auth_headers)
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "storage" in detail.lower() and "Invalid API key" in detail
    assert KEY not in detail and "***" in detail


def test_storage_check_reports_ok_and_failure(monkeypatch):
    class Fine:
        class storage:
            @staticmethod
            def get_bucket(name):
                return {"name": name}

    monkeypatch.setattr(storage, "client", lambda: Fine())
    assert storage.check() == "ok"
    monkeypatch.setattr(storage, "client", lambda: Boom())
    msg = storage.check()
    assert "Invalid API key" in msg and KEY not in msg


def test_storage_error_includes_supabase_reply():
    import httpx

    request = httpx.Request("POST", "https://abc.supabase.co/storage/v1/object/upload/sign/recordings/x?token=t")
    response = httpx.Response(400, request=request, text='{"statusCode":"404","message":"Bucket not found"}')
    try:
        try:
            raise httpx.HTTPStatusError("bad", request=request, response=response)
        except httpx.HTTPStatusError:
            raise KeyError("error")
    except KeyError as e:
        msg = str(storage._explain(e))
    assert "Bucket not found" in msg and "abc.supabase.co/storage/v1" in msg and "token=" not in msg


def test_project_url_strips_api_paths():
    base = "https://abc.supabase.co"
    for url in (base, base + "/", base + "/rest/v1/", base + "/rest/v1", " " + base + "/storage/v1/ "):
        assert storage.project_url(url) == base


def test_reference_recording_from_a_link_keeps_its_licence(client, auth_headers):
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Paddana (archive copy)", "audio_url": "https://archive.example/paddana.mp3",
        "licence": "CC BY 4.0", "consent_public": True, "notes": "Source: Example Archive",
    })
    assert resp.status_code == 201, resp.text
    assert resp.json()["licence"] == "CC BY 4.0"
    plain = client.post("/recordings", headers=auth_headers, json={"title": "Mine", "audio_url": "https://x/a.webm"})
    assert plain.json()["licence"] == "CC-BY-NC-4.0"
    bad = client.post("/recordings", headers=auth_headers, json={"title": "Bad", "audio_url": "file:///etc/passwd"})
    assert bad.status_code == 422
