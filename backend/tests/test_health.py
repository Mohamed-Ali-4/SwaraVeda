def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_health_db_reports_error_without_password(client):
    # The test DATABASE_URL points at a server that isn't running.
    resp = client.get("/health/db")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "error"
    assert "test:test" not in body["detail"]
