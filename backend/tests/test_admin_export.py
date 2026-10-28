import json
from uuid import UUID

from sqlmodel import Session

from app.config import settings
from app.models import Segment


def test_configured_admin_email_is_promoted(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", "Boss@Example.com, other@example.com")
    resp = client.post("/auth/register", json={
        "display_name": "Boss", "email": "boss@example.com", "password": "password123",
    })
    assert resp.json()["role"] == "admin"


def test_admin_lists_users_and_sets_roles(client, admin_headers, auth_headers):
    users = client.get("/admin/users", headers=admin_headers).json()
    contributor = next(u for u in users if u["email"] == "test@example.com")
    assert contributor["role"] == "contributor"

    resp = client.patch(f"/admin/users/{contributor['id']}", headers=admin_headers,
                        json={"role": "verifier"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "verifier"


def test_admin_endpoints_need_admin(client, auth_headers):
    assert client.get("/admin/users", headers=auth_headers).status_code == 403


def test_admin_cannot_demote_self(client, admin_headers):
    me = next(u for u in client.get("/admin/users", headers=admin_headers).json()
              if u["email"] == "admin@example.com")
    resp = client.patch(f"/admin/users/{me['id']}", headers=admin_headers,
                        json={"role": "contributor"})
    assert resp.status_code == 400


def test_verifier_can_set_dialect_language(client, admin_headers, auth_headers):
    d = client.post("/dialects", headers=auth_headers, json={"name": "Kodava"}).json()
    assert client.patch(f"/dialects/{d['id']}", headers=auth_headers,
                        json={"asr_language": "kn"}).status_code == 403
    resp = client.patch(f"/dialects/{d['id']}", headers=admin_headers, json={"asr_language": "kn"})
    assert resp.status_code == 200
    assert resp.json()["asr_language"] == "kn"


def _add_recording(client, headers, session, title, consent, segments):
    rec = client.post("/recordings", headers=headers, json={
        "title": title, "consent_ai_training": consent, "audio_url": f"https://x/{title}.webm",
    }).json()
    for i, (asr, corrected) in enumerate(segments):
        session.add(Segment(recording_id=UUID(rec["id"]), seq=i + 1, start_ms=i * 1000,
                            end_ms=i * 1000 + 900, asr_text=asr, corrected_text=corrected))
    session.commit()
    return rec["id"]


def test_export_only_consented_corrected_segments(client, admin_headers, session: Session):
    _add_recording(client, admin_headers, session, "consented", True,
                   [("helo", "hello"), ("uncorrected", None)])
    _add_recording(client, admin_headers, session, "private", False, [("secret", "secret")])

    resp = client.get("/export/segments", headers=admin_headers)
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    rows = [json.loads(line) for line in resp.text.splitlines()]
    assert [(r["asr_text"], r["corrected_text"]) for r in rows] == [("helo", "hello")]
    assert rows[0]["audio_url"] == "https://x/consented.webm"


def test_export_csv(client, admin_headers, session: Session):
    _add_recording(client, admin_headers, session, "c", True, [("a", "b")])
    resp = client.get("/export/segments?format=csv", headers=admin_headers)
    lines = resp.text.strip().splitlines()
    assert lines[0].startswith("segment_id,recording_id")
    assert len(lines) == 2


def test_export_needs_verifier(client, auth_headers):
    assert client.get("/export/segments", headers=auth_headers).status_code == 403
