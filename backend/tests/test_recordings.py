import pytest


@pytest.fixture
def dialect_id(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={
        "name": "Test Dialect",
    })
    return resp.json()["id"]


def test_create_recording(client, auth_headers, dialect_id):
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Morning Song",
        "dialect_id": dialect_id,
        "genre": "song",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Morning Song"
    assert data["status"] == "uploaded"


def test_list_recordings(client, auth_headers, dialect_id):
    client.post("/recordings", headers=auth_headers, json={
        "title": "Rec 1", "dialect_id": dialect_id,
    })
    client.post("/recordings", headers=auth_headers, json={
        "title": "Rec 2", "dialect_id": dialect_id,
    })
    resp = client.get("/recordings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2


def test_list_recordings_pagination(client, auth_headers, dialect_id):
    for i in range(5):
        client.post("/recordings", headers=auth_headers, json={
            "title": f"Rec {i}", "dialect_id": dialect_id,
        })
    resp = client.get("/recordings?page=1&page_size=2")
    assert resp.status_code == 200
    assert len(resp.json()["items"]) == 2


def test_get_recording(client, auth_headers, dialect_id):
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Detail Test", "dialect_id": dialect_id,
    })
    rec_id = resp.json()["id"]
    resp = client.get(f"/recordings/{rec_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["recording"]["title"] == "Detail Test"
    assert data["segments"] == []


def test_patch_recording(client, auth_headers, dialect_id):
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Patch Test", "dialect_id": dialect_id,
    })
    rec_id = resp.json()["id"]
    resp = client.patch(f"/recordings/{rec_id}", headers=auth_headers, json={
        "title": "Patched Title",
    })
    assert resp.status_code == 200
    assert resp.json()["title"] == "Patched Title"


def test_delete_recording_owner(client, auth_headers, dialect_id):
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "To Delete", "dialect_id": dialect_id,
    })
    rec_id = resp.json()["id"]
    resp = client.delete(f"/recordings/{rec_id}", headers=auth_headers)
    # Only admin or owner can delete; contributor is owner here
    # The check is `user.role not in ("admin",)` so non-admin owners can't delete
    # Actually re-reading: it's `rec.contributor_id != user.id and user.role not in ("admin",)`
    # So owner CAN delete
    assert resp.status_code == 204


def test_get_recording_not_found(client):
    resp = client.get("/recordings/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_create_recording_unauthenticated(client):
    resp = client.post("/recordings", json={"title": "No Auth"})
    assert resp.status_code == 401
