from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.config import settings
from app.db import engine
from app.routers import auth_routes, dialects, recordings, segments, search, stats, tags, jobs

app = FastAPI(
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
    """Checks the database connection. Errors are returned with the password
    redacted so a broken deploy can be diagnosed without log access."""
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
        return {"status": "ok"}
    except Exception as e:
        msg = str(e).split("\n(Background")[0]
        password = make_url(settings.DATABASE_URL).password
        if password:
            msg = msg.replace(password, "***")
        return {"status": "error", "error": type(e).__name__, "detail": msg[:500]}
