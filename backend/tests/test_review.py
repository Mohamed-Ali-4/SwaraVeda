from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session

from app.models import Segment


def _recording(client, headers, session, title, segments):
    d = client.post("/dialects", headers=headers, json={"name": f"{title} dialect"}).json()
    rec = client.post("/recordings", headers=headers, json={
        "title": title, "dialect_id": d["id"], "audio_url": f"https://x/{title}.ogg",
        "speaker_name": "Kamala",
    }).json()
    for i, (asr, corrected, verified) in enumerate(segments):
        session.add(Segment(
            recording_id=UUID(rec["id"]), seq=i + 1, start_ms=i * 1000, end_ms=i * 1000 + 900,
            asr_text=asr, corrected_text=corrected,
            verified_at=datetime.now(timezone.utc) if verified else None,
        ))
    session.commit()
    return rec


def test_review_queue_states(client, auth_headers, session: Session):
    _recording(client, auth_headers, session, "Paddana", [
        ("draft one", None, False),
        ("draft two", "corrected two", False),
        ("draft three", "corrected three", True),
    ])
    body = client.get("/review/segments", headers=auth_headers).json()
    assert body["counts"] == {"needs_correction": 1, "needs_verification": 1, "verified": 1}
    [item] = body["items"]
    assert item["segment"]["corrected_text"] == "corrected two"
    assert item["recording_title"] == "Paddana"
    assert item["audio_url"] == "https://x/Paddana.ogg"
    assert item["dialect_name"] == "Paddana dialect"

    todo = client.get("/review/segments?state=needs_correction", headers=auth_headers).json()
    assert [i["segment"]["asr_text"] for i in todo["items"]] == ["draft one"]


def test_review_queue_filters_by_dialect(client, auth_headers, session: Session):
    a = _recording(client, auth_headers, session, "A", [("x", "y", False)])
    _recording(client, auth_headers, session, "B", [("x", "y", False)])
    body = client.get(f"/review/segments?dialect_id={a['dialect_id']}", headers=auth_headers).json()
    assert body["counts"]["needs_verification"] == 1
    assert [i["recording_title"] for i in body["items"]] == ["A"]


def test_review_queue_needs_login(client):
    assert client.get("/review/segments").status_code == 401


def test_recordings_title_search(client, auth_headers, session: Session):
    _recording(client, auth_headers, session, "Harvest song", [])
    _recording(client, auth_headers, session, "Wedding song", [])
    titles = lambda q: [r["title"] for r in client.get(f"/recordings?q={q}").json()["items"]]
    assert titles("harvest") == ["Harvest song"]
    assert sorted(titles("song")) == ["Harvest song", "Wedding song"]
    assert len(titles("kamala")) == 2  # speaker name


def test_register_rejects_short_password(client):
    resp = client.post("/auth/register", json={
        "display_name": "A", "email": "short@example.com", "password": "1234567",
    })
    assert resp.status_code == 422
    assert "at least 8 characters" in resp.text
