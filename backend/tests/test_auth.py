def test_register(client):
    resp = client.post("/auth/register", json={
        "display_name": "New User",
        "email": "new@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["display_name"] == "New User"
    assert data["role"] == "contributor"


def test_register_duplicate(client):
    payload = {
        "display_name": "Dup User",
        "email": "dup@example.com",
        "password": "password123",
    }
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/register", json=payload)
    assert resp.status_code == 409


def test_login(client):
    client.post("/auth/register", json={
        "display_name": "Login User",
        "email": "login@example.com",
        "password": "password123",
    })
    resp = client.post("/auth/login", json={
        "email": "login@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "display_name": "User",
        "email": "wrong@example.com",
        "password": "password123",
    })
    resp = client.post("/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


def test_me(client, auth_headers):
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "test@example.com"


def test_me_unauthenticated(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_refresh(client, auth_headers):
    resp = client.post("/auth/refresh", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_update_profile(client, auth_headers):
    resp = client.patch("/auth/me", headers=auth_headers, json={
        "display_name": "Updated Name",
    })
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Updated Name"


def test_change_password(client, auth_headers):
    resp = client.post("/auth/change-password", headers=auth_headers, json={
        "current_password": "testpassword123",
        "new_password": "newpassword456",
    })
    assert resp.status_code == 204

    resp = client.post("/auth/login", json={
        "email": "test@example.com",
        "password": "newpassword456",
    })
    assert resp.status_code == 200


def test_change_password_wrong_current(client, auth_headers):
    resp = client.post("/auth/change-password", headers=auth_headers, json={
        "current_password": "wrongpassword",
        "new_password": "newpassword456",
    })
    assert resp.status_code == 400
