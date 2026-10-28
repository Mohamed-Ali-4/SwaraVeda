"""Tests that need real Postgres + pgvector: full-text and vector search,
startup migrations. Skipped unless TEST_POSTGRES_URL is set; CI sets it."""
import os
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, create_engine

from app import main as app_main, migrations, nlp, pipeline
from app.db import get_session
from app.main import app
from app.models import Segment

PG_URL = os.environ.get("TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not PG_URL, reason="set TEST_POSTGRES_URL to run")

SCHEMA = (Path(__file__).parent.parent / "schema.sql").read_text()
TABLES = "recording_tags, tags, jobs, segments, recordings, dialects, contributors"


@pytest.fixture
def pg_engine():
    engine = create_engine(PG_URL)
    with engine.begin() as conn:
        conn.exec_driver_sql(f"drop table if exists {TABLES} cascade")
        conn.exec_driver_sql(SCHEMA)
    yield engine
    engine.dispose()


@pytest.fixture
def pg_client(pg_engine, monkeypatch):
    def override():
        with Session(pg_engine) as s:
            yield s

    @contextmanager
    def new_session():
        with Session(pg_engine) as s:
            yield s

    app.dependency_overrides[get_session] = override
    monkeypatch.setattr(pipeline, "new_session", new_session)
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def headers(pg_client):
    resp = pg_client.post("/auth/register", json={
        "display_name": "Pg", "email": "pg@example.com", "password": "password123",
    })
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture
def two_recordings(pg_client, headers, pg_engine):
    ids = {}
    for name, words in (("Tulu", ["paddana harvest song", "rain over the paddy"]),
                        ("Kodava", ["wedding song", "valaga dance"])):
        d = pg_client.post("/dialects", headers=headers, json={"name": name}).json()
        r = pg_client.post("/recordings", headers=headers, json={
            "title": f"{name} recording", "dialect_id": d["id"],
        }).json()
        with Session(pg_engine) as s:
            for i, w in enumerate(words):
                s.add(Segment(recording_id=r["id"], seq=i + 1, start_ms=i * 1000,
                              end_ms=i * 1000 + 900, asr_text=w))
            s.commit()
        ids[name] = d["id"]
    return ids


def test_keyword_search(pg_client, two_recordings):
    hits = pg_client.get("/search?q=song").json()["hits"]
    assert {h["text"] for h in hits} == {"paddana harvest song", "wedding song"}
    # Hits carry what the search page needs to play the passage.
    assert {h["dialect_name"] for h in hits} == {"Tulu", "Kodava"}
    assert all("audio_url" in h for h in hits)

    hits = pg_client.get(f"/search?q=song&dialect_id={two_recordings['Kodava']}").json()["hits"]
    assert [h["text"] for h in hits] == ["wedding song"]


def test_keyword_search_prefers_corrected_text(pg_client, headers, two_recordings):
    seg = pg_client.get("/search?q=valaga").json()["hits"][0]
    pg_client.patch(f"/segments/{seg['segment_id']}", headers=headers,
                    json={"corrected_text": "valaga drum dance"})
    hits = pg_client.get("/search?q=drum").json()["hits"]
    assert [h["text"] for h in hits] == ["valaga drum dance"]


def fake_vector(text_: str) -> list[float]:
    # 384-dim one-hot by topic, so similarity is predictable.
    vec = [0.0] * 384
    vec[0 if ("song" in text_ or "music" in text_) else 1] = 1.0
    return vec


def test_semantic_search(pg_client, pg_engine, two_recordings, monkeypatch):
    monkeypatch.setattr(nlp, "embeddings_enabled", lambda: True)
    monkeypatch.setattr(nlp, "embed_texts", lambda texts: [fake_vector(t) for t in texts])
    with Session(pg_engine) as s:
        segs = s.exec(text("select id, asr_text from segments")).all()
        pipeline.embed_segments(s, [Segment(id=i, recording_id=i, seq=0, start_ms=0, end_ms=0,
                                            asr_text=t) for i, t in segs])

    hits = pg_client.get("/search/semantic?q=music&limit=2").json()["hits"]
    assert {h["text"] for h in hits} == {"paddana harvest song", "wedding song"}
    assert hits[0]["score"] == pytest.approx(1.0)

    hits = pg_client.get(f"/search/semantic?q=music&limit=5&dialect_id={two_recordings['Tulu']}").json()["hits"]
    assert hits[0]["text"] == "paddana harvest song"
    assert all(h["recording_title"] == "Tulu recording" for h in hits)


def test_health_db_ok(pg_client, pg_engine, monkeypatch):
    monkeypatch.setattr(app_main, "engine", pg_engine)
    body = pg_client.get("/health/db").json()
    assert body["status"] == "ok"
    assert body["schema"] == {}


LEGACY_SCHEMA = """
create extension if not exists vector;
create table contributors (id uuid primary key default gen_random_uuid(),
  display_name text not null, email text unique not null, role text default 'contributor',
  native_dialect text, created_at timestamptz default now());
create table dialects (id uuid primary key default gen_random_uuid(), name text not null,
  iso_code text, region text, script text, endangerment_status text, description text);
create table recordings (id uuid primary key default gen_random_uuid(), title text not null,
  audio_url text, duration_seconds numeric, dialect_id uuid, contributor_id uuid,
  speaker_name text, speaker_age_group text, genre text, recorded_place text, recorded_at date,
  consent_public boolean not null default false, consent_ai_training boolean not null default false,
  licence text, status text not null default 'uploaded', created_at timestamptz default now());
create table segments (id uuid primary key default gen_random_uuid(), recording_id uuid not null,
  seq int not null, start_ms int not null, end_ms int not null, asr_text text, corrected_text text,
  transliteration text, translation_en text, verified_by uuid, verified_at timestamptz,
  embedding vector(768));
"""


def test_migrations_repair_legacy_tables(pg_engine, monkeypatch):
    """Tables from an older schema survive `create table if not exists`;
    startup migrations add what they lack so the app works on them."""
    with pg_engine.begin() as conn:
        conn.exec_driver_sql(f"drop table if exists {TABLES} cascade")
        conn.exec_driver_sql(LEGACY_SCHEMA)
        conn.exec_driver_sql(SCHEMA)  # what the user ran: skips existing tables

    migrations.run(pg_engine)
    migrations.run(pg_engine)  # idempotent

    monkeypatch.setattr(app_main, "engine", pg_engine)
    with TestClient(app) as client:
        app.dependency_overrides[get_session] = lambda: (yield from _session(pg_engine))
        try:
            body = client.get("/health/db").json()
            assert body["status"] == "ok", body
            assert body["schema"] == {}
            resp = client.post("/auth/register", json={
                "display_name": "Legacy", "email": "legacy@example.com", "password": "password123",
            })
            assert resp.status_code == 200, resp.text
        finally:
            app.dependency_overrides.clear()

    with pg_engine.connect() as conn:
        dim = conn.execute(text(
            "select format_type(atttypid, atttypmod) from pg_attribute "
            "where attrelid = 'segments'::regclass and attname = 'embedding'"
        )).scalar()
    assert dim == "vector(384)"


def _session(engine):
    with Session(engine) as s:
        yield s
