def test_create_dialect(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={
        "name": "Tulu",
        "iso_code": "tcy",
        "region": "Karnataka",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Tulu"
    assert data["iso_code"] == "tcy"


def test_list_dialects(client, auth_headers):
    client.post("/dialects", headers=auth_headers, json={"name": "Dialect A"})
    client.post("/dialects", headers=auth_headers, json={"name": "Dialect B"})
    resp = client.get("/dialects")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


def test_list_dialects_pagination(client, auth_headers):
    for i in range(5):
        client.post("/dialects", headers=auth_headers, json={"name": f"Dialect {i}"})
    resp = client.get("/dialects?page=1&page_size=2")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_get_dialect(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={"name": "Kodava"})
    dialect_id = resp.json()["id"]
    resp = client.get(f"/dialects/{dialect_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Kodava"


def test_get_dialect_not_found(client):
    resp = client.get("/dialects/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


def test_delete_dialect_admin(client, admin_headers):
    resp = client.post("/dialects", headers=admin_headers, json={"name": "ToDelete"})
    dialect_id = resp.json()["id"]
    resp = client.delete(f"/dialects/{dialect_id}", headers=admin_headers)
    assert resp.status_code == 204


def test_delete_dialect_non_admin(client, auth_headers):
    resp = client.post("/dialects", headers=auth_headers, json={"name": "NoDelete"})
    dialect_id = resp.json()["id"]
    resp = client.delete(f"/dialects/{dialect_id}", headers=auth_headers)
    assert resp.status_code == 403


def test_create_dialect_unauthenticated(client):
    resp = client.post("/dialects", json={"name": "Test"})
    assert resp.status_code == 401
