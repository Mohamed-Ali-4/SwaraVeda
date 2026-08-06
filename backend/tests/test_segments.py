import pytest
from uuid import UUID
from sqlmodel import Session
from app.models import Segment


@pytest.fixture
def recording_with_segments(client, auth_headers, session: Session):
    resp = client.post("/dialects", headers=auth_headers, json={"name": "Seg Dialect"})
    dialect_id = resp.json()["id"]

    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Seg Recording", "dialect_id": dialect_id,
    })
    rec_id = UUID(resp.json()["id"])

    seg1 = Segment(recording_id=rec_id, seq=1, start_ms=0, end_ms=5000, asr_text="hello world")
    seg2 = Segment(recording_id=rec_id, seq=2, start_ms=5000, end_ms=10000, asr_text="goodbye")
    session.add(seg1)
    session.add(seg2)
    session.commit()
    session.refresh(seg1)
    session.refresh(seg2)
    return rec_id, str(seg1.id), str(seg2.id)


def test_get_segment(client, recording_with_segments):
    _, seg_id, _ = recording_with_segments
    resp = client.get(f"/segments/{seg_id}")
    assert resp.status_code == 200
    assert resp.json()["asr_text"] == "hello world"


def test_correct_segment(client, auth_headers, recording_with_segments):
    _, seg_id, _ = recording_with_segments
    resp = client.patch(f"/segments/{seg_id}", headers=auth_headers, json={
        "corrected_text": "hello world corrected",
    })
    assert resp.status_code == 200
    assert resp.json()["corrected_text"] == "hello world corrected"
    assert resp.json()["asr_text"] == "hello world"


def test_list_recording_segments(client, recording_with_segments):
    rec_id, _, _ = recording_with_segments
    resp = client.get(f"/recordings/{rec_id}/segments")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_delete_segment(client, auth_headers, recording_with_segments):
    _, seg_id, _ = recording_with_segments
    resp = client.delete(f"/segments/{seg_id}", headers=auth_headers)
    assert resp.status_code == 204
    resp = client.get(f"/segments/{seg_id}")
    assert resp.status_code == 404


def test_segment_not_found(client):
    resp = client.get("/segments/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404
