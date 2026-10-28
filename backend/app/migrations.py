"""Idempotent schema changes applied at API startup, so a deployed database
picks up new columns without anyone re-running schema.sql by hand. Keep
schema.sql in sync with every statement added here."""
import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

STATEMENTS = [
    "alter table dialects add column if not exists asr_language text",
]


def run(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            for stmt in STATEMENTS:
                conn.execute(text(stmt))
        logger.info("Applied %d startup migrations", len(STATEMENTS))
    except Exception:
        # Don't take the API down; /health/db shows what's wrong.
        logger.exception("Startup migrations failed")
