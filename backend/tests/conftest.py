import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from app.main import app
from app.db import get_session


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers")
def auth_headers_fixture(client: TestClient):
    resp = client.post("/auth/register", json={
        "display_name": "Test User",
        "email": "test@example.com",
        "password": "testpassword123",
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(name="admin_headers")
def admin_headers_fixture(client: TestClient, session: Session):
    from app.models import Contributor
    resp = client.post("/auth/register", json={
        "display_name": "Admin User",
        "email": "admin@example.com",
        "password": "adminpassword123",
    })
    token = resp.json()["access_token"]
    from sqlmodel import select
    user = session.exec(
        select(Contributor).where(Contributor.email == "admin@example.com")
    ).first()
    user.role = "admin"
    session.add(user)
    session.commit()
    return {"Authorization": f"Bearer {token}"}
