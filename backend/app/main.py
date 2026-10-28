from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlmodel import Session, select

from app import migrations, nlp
from app.config import settings
from app.db import engine
from app.models import Contributor, Dialect, Job, Recording, Segment, Tag
from app.routers import (
    admin, auth_routes, dialects, export, jobs, recordings, review, search, segments, stats,
    tags,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrations.run(engine)
    yield


app = FastAPI(
    lifespan=lifespan,
    title="SwaraVeda API",
    description="Community-driven digital archive for endangered dialects and oral traditions.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(dialects.router)
app.include_router(recordings.router)
app.include_router(segments.router)
app.include_router(search.router)
app.include_router(stats.router)
app.include_router(tags.router)
app.include_router(jobs.router)
app.include_router(admin.router)
app.include_router(export.router)
app.include_router(review.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "swaraveda-api"}


@app.get("/nlp/status", tags=["meta"])
def nlp_status():
    """Which AI features this server has configured, so the UI can hide the rest."""
    return {
        "transcription": nlp.transcription_enabled(),
        "translation": nlp.translation_enabled(),
        "semantic_search": nlp.embeddings_enabled(),
    }


@app.get("/health/db", tags=["meta"])
def health_db():
    """Checks the database connection and each table. Errors are returned with
    the password redacted so a broken deploy can be diagnosed without log access."""
    password = make_url(settings.DATABASE_URL).password

    def clean(e: Exception) -> str:
        msg = str(e).split("\n(Background")[0].split("\n[SQL:")[0]
        return (msg.replace(password, "***") if password else msg)[:300]

    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
    except Exception as e:
        return {"status": "error", "error": type(e).__name__, "detail": clean(e)}

    # Query through the models, so a column the code expects but the
    # database lacks shows up here too.
    tables = {}
    for model in (Contributor, Dialect, Recording, Segment, Tag, Job):
        try:
            with Session(engine) as session:
                session.exec(select(model).limit(1)).all()
            tables[model.__tablename__] = "ok"
        except Exception as e:
            tables[model.__tablename__] = clean(e)
    # Row-level security or missing grants would block inserts but not reads.
    try:
        with engine.connect() as conn:
            trans = conn.begin()
            conn.execute(text("insert into tags (id, label) values (gen_random_uuid(), :l)"),
                         {"l": "__health_check__"})
            trans.rollback()
        tables["write"] = "ok"
    except Exception as e:
        tables["write"] = clean(e)

    ok = all(v == "ok" for v in tables.values())
    return {"status": "ok" if ok else "error", "tables": tables, "schema": _schema_drift()}


def _schema_drift() -> dict:
    """Columns the database has that the code doesn't know about (a NOT NULL
    one without a default would break inserts), and columns it lacks."""
    if engine.dialect.name != "postgresql":
        return {}
    drift = {}
    with engine.connect() as conn:
        rows = conn.execute(text(
            "select table_name, column_name, data_type, udt_name, is_nullable, column_default "
            "from information_schema.columns where table_schema = 'public'"
        )).mappings().all()
    by_table: dict[str, dict] = {}
    for r in rows:
        by_table.setdefault(r["table_name"], {})[r["column_name"]] = r
    for model in (Contributor, Dialect, Recording, Segment, Tag, Job):
        db_cols = by_table.get(model.__tablename__, {})
        # segments.embedding is pgvector, written with raw SQL, not on the model.
        code_cols = set(model.__table__.columns.keys()) | (
            {"embedding"} if model is Segment else set()
        )
        extra = {
            name: f"{c['udt_name']}{' not null' if c['is_nullable'] == 'NO' else ''}"
                  f"{' default ' + c['column_default'] if c['column_default'] else ''}"
            for name, c in db_cols.items() if name not in code_cols
        }
        missing = sorted(code_cols - db_cols.keys() - {"embedding"})
        if extra or missing:
            drift[model.__tablename__] = {"extra": extra, "missing": missing}
    return drift
