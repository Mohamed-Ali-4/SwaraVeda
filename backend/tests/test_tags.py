import pytest


@pytest.fixture
def recording_id(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={"name": "Tag Dialect"})
    dialect_id = resp.json()["id"]
    resp = client.post("/recordings", headers=auth_headers, json={
        "title": "Tag Recording", "dialect_id": dialect_id,
    })
    return resp.json()["id"]


def test_create_tag(client, auth_headers):
    resp = client.post("/tags", headers=auth_headers, json={
        "label": "folk-song",
        "category": "genre",
    })
    assert resp.status_code == 201
    assert resp.json()["label"] == "folk-song"


def test_create_duplicate_tag(client, auth_headers):
    client.post("/tags", headers=auth_headers, json={"label": "dup-tag"})
    resp = client.post("/tags", headers=auth_headers, json={"label": "dup-tag"})
    assert resp.status_code == 409


def test_list_tags(client, auth_headers):
    client.post("/tags", headers=auth_headers, json={"label": "tag-a"})
    client.post("/tags", headers=auth_headers, json={"label": "tag-b"})
    resp = client.get("/tags")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_get_tag(client, auth_headers):
    resp = client.post("/tags", headers=auth_headers, json={"label": "get-tag"})
    tag_id = resp.json()["id"]
    resp = client.get(f"/tags/{tag_id}")
    assert resp.status_code == 200
    assert resp.json()["label"] == "get-tag"


def test_delete_tag_admin(client, admin_headers):
    resp = client.post("/tags", headers=admin_headers, json={"label": "del-tag"})
    tag_id = resp.json()["id"]
    resp = client.delete(f"/tags/{tag_id}", headers=admin_headers)
    assert resp.status_code == 204


def test_delete_tag_non_admin(client, auth_headers):
    resp = client.post("/tags", headers=auth_headers, json={"label": "no-del"})
    tag_id = resp.json()["id"]
    resp = client.delete(f"/tags/{tag_id}", headers=auth_headers)
    assert resp.status_code == 403


def test_add_tag_to_recording(client, auth_headers, recording_id):
    resp = client.post("/tags", headers=auth_headers, json={"label": "attach-tag"})
    tag_id = resp.json()["id"]
    resp = client.post(f"/tags/{recording_id}/tags", headers=auth_headers, json={
        "tag_id": tag_id,
    })
    assert resp.status_code == 201


def test_list_recording_tags(client, auth_headers, recording_id):
    resp = client.post("/tags", headers=auth_headers, json={"label": "list-rt"})
    tag_id = resp.json()["id"]
    client.post(f"/tags/{recording_id}/tags", headers=auth_headers, json={"tag_id": tag_id})
    resp = client.get(f"/tags/{recording_id}/tags")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_remove_tag_from_recording(client, auth_headers, recording_id):
    resp = client.post("/tags", headers=auth_headers, json={"label": "rm-rt"})
    tag_id = resp.json()["id"]
    client.post(f"/tags/{recording_id}/tags", headers=auth_headers, json={"tag_id": tag_id})
    resp = client.delete(f"/tags/{recording_id}/tags/{tag_id}", headers=auth_headers)
    assert resp.status_code == 204
