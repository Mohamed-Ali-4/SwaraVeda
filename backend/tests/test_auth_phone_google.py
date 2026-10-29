import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from app import google_auth
from app.config import settings
from app.phone import normalize_phone


@pytest.mark.parametrize("raw, expected", [
    ("98765 43210", "+919876543210"),
    ("098765-43210", "+919876543210"),
    ("919876543210", "+919876543210"),
    ("+91 98765 43210", "+919876543210"),
    ("+44 7700 900123", "+447700900123"),
])
def test_normalize_phone(raw, expected):
    assert normalize_phone(raw) == expected


@pytest.mark.parametrize("raw", ["12345", "5876543210", "abc", "+0123"])
def test_normalize_phone_rejects(raw):
    with pytest.raises(ValueError):
        normalize_phone(raw)


def _register(client, **extra):
    body = {"display_name": "Kamala", "email": "kamala@example.com", "password": "password123", **extra}
    return client.post("/auth/register", json=body)


def test_register_with_phone_and_login_by_phone(client):
    assert _register(client, phone="98765 43210").status_code == 200
    me = client.get("/auth/me", headers={
        "Authorization": f"Bearer {client.post('/auth/login', json={'email': '+91-98765-43210', 'password': 'password123'}).json()['access_token']}"
    }).json()
    assert me["phone"] == "+919876543210"
    assert client.post("/auth/login", json={"email": "9876543210", "password": "wrong-pass"}).status_code == 401
    # Email login is case-insensitive.
    assert client.post("/auth/login", json={"email": "KAMALA@example.com", "password": "password123"}).status_code == 200


def test_duplicate_phone_and_bad_phone(client):
    _register(client, phone="9876543210")
    resp = _register(client, email="other@example.com", phone="+919876543210")
    assert resp.status_code == 409 and "Mobile number" in resp.json()["detail"]
    bad = _register(client, email="third@example.com", phone="12345")
    assert bad.status_code == 422 and "valid mobile number" in bad.text


def test_profile_phone_update(client, auth_headers):
    resp = client.patch("/auth/me", headers=auth_headers, json={"phone": "91234 56789"})
    assert resp.json()["phone"] == "+919123456789"


# ---- Google sign-in ----

@pytest.fixture
def google_keys(monkeypatch):
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                serialization.NoEncryption()).decode()
    public_pem = private.public_key().public_bytes(serialization.Encoding.PEM,
                                                   serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    public = jwk.construct(public_pem, "RS256").to_dict()
    public.update(kid="test-key", use="sig", alg="RS256")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com")
    monkeypatch.setattr(google_auth, "_google_keys", lambda: {"keys": [public]})

    def make(**claims):
        base = {
            "iss": "https://accounts.google.com", "aud": settings.GOOGLE_CLIENT_ID, "sub": "1234",
            "email": "devi@gmail.com", "email_verified": True, "name": "Devi Rao",
            "iat": int(time.time()), "exp": int(time.time()) + 600,
        }
        base.update(claims)
        return jwt.encode(base, pem, algorithm="RS256", headers={"kid": "test-key"})
    return make


def test_google_creates_then_signs_in_account(client, google_keys):
    resp = client.post("/auth/google", json={"credential": google_keys()})
    assert resp.status_code == 200, resp.text
    assert resp.json()["display_name"] == "Devi Rao"
    again = client.post("/auth/google", json={"credential": google_keys()})
    assert again.status_code == 200
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {again.json()['access_token']}"}).json()
    assert me["email"] == "devi@gmail.com"


def test_google_links_existing_email_account(client, google_keys):
    _register(client, email="devi@gmail.com")
    resp = client.post("/auth/google", json={"credential": google_keys()})
    assert resp.json()["display_name"] == "Kamala"


@pytest.mark.parametrize("claims", [
    {"aud": "someone-else"}, {"email_verified": False}, {"exp": int(time.time()) - 10},
    {"iss": "https://evil.example.com"},
])
def test_google_rejects_bad_tokens(client, google_keys, claims):
    assert client.post("/auth/google", json={"credential": google_keys(**claims)}).status_code == 401


def test_google_rejects_forged_signature(client, google_keys):
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    forged = jwt.encode({"iss": "accounts.google.com", "aud": settings.GOOGLE_CLIENT_ID, "email": "x@gmail.com",
                         "email_verified": True, "exp": int(time.time()) + 60}, other, algorithm="RS256",
                        headers={"kid": "test-key"})
    assert client.post("/auth/google", json={"credential": forged}).status_code == 401


def test_google_off_without_client_id(client):
    assert client.post("/auth/google", json={"credential": "x"}).status_code == 503
    assert client.get("/auth/config").json() == {"google_client_id": None}
