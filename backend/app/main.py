from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app import migrations
from app.config import settings
from app.db import engine
from app.routers import auth_routes, dialects, recordings, segments, search, stats, tags, jobs


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


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "swaraveda-api"}


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

    tables = {}
    for table in ("contributors", "dialects", "recordings", "segments", "tags", "jobs"):
        try:
            with engine.connect() as conn:
                conn.execute(text(f"select * from {table} limit 1"))
            tables[table] = "ok"
        except Exception as e:
            tables[table] = clean(e)
    ok = all(v == "ok" for v in tables.values())
    return {"status": "ok" if ok else "error", "tables": tables}
