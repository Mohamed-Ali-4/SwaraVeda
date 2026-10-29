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
