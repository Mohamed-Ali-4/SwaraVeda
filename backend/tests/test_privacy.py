"""Recordings without public-listening consent stay private."""
from uuid import UUID

from sqlmodel import Session

from app.models import Segment


def _register(client, email):
    token = client.post("/auth/register", json={
        "display_name": email.split("@")[0], "email": email, "password": "password123",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make(client, headers, title, public):
    return client.post("/recordings", headers=headers, json={
        "title": title, "consent_public": public,
    }).json()["id"]


def test_private_recordings_hidden_from_others(client, auth_headers, admin_headers, session: Session):
    public_id = _make(client, auth_headers, "Public song", True)
    private_id = _make(client, auth_headers, "Private story", False)
    session.add(Segment(recording_id=UUID(private_id), seq=1, start_ms=0, end_ms=1, asr_text="secret"))
    session.commit()
    stranger = _register(client, "stranger@example.com")

    titles = lambda h=None: {r["title"] for r in client.get("/recordings", headers=h or {}).json()["items"]}
    assert titles() == {"Public song"}                                  # anonymous
    assert titles(stranger) == {"Public song"}                          # another contributor
    assert titles(auth_headers) == {"Public song", "Private story"}     # the uploader
    assert titles(admin_headers) == {"Public song", "Private story"}    # admin/verifier

    assert client.get(f"/recordings/{private_id}").status_code == 404
    assert client.get(f"/recordings/{private_id}/segments", headers=stranger).status_code == 404
    assert client.get(f"/recordings/{private_id}", headers=auth_headers).status_code == 200
    assert client.get(f"/recordings/{public_id}").status_code == 200

    total = client.get("/recordings").json()["total"]
    assert total == 1


def test_private_segments_not_in_strangers_review_queue(client, auth_headers, admin_headers, session: Session):
    private_id = _make(client, auth_headers, "Private", False)
    session.add(Segment(recording_id=UUID(private_id), seq=1, start_ms=0, end_ms=1,
                        asr_text="a", corrected_text="b"))
    session.commit()
    stranger = _register(client, "stranger2@example.com")
    assert client.get("/review/segments", headers=stranger).json()["counts"]["needs_verification"] == 0
    assert client.get("/review/segments", headers=auth_headers).json()["counts"]["needs_verification"] == 1
    assert client.get("/review/segments", headers=admin_headers).json()["counts"]["needs_verification"] == 1


def test_stale_token_is_treated_as_anonymous(client, auth_headers):
    _make(client, auth_headers, "Public", True)
    resp = client.get("/recordings", headers={"Authorization": "Bearer not-a-token"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1


def test_private_segment_not_readable_by_id(client, auth_headers, session: Session):
    private_id = _make(client, auth_headers, "Private", False)
    seg = Segment(recording_id=UUID(private_id), seq=1, start_ms=0, end_ms=1, asr_text="secret")
    session.add(seg)
    session.commit()
    assert client.get(f"/segments/{seg.id}").status_code == 404
    assert client.get(f"/segments/{seg.id}", headers=auth_headers).status_code == 200
