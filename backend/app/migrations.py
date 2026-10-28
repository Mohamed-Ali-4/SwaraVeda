"""Idempotent schema changes applied at API startup, so a deployed database
picks up new columns without anyone re-running schema.sql by hand. They also
repair tables created by an older schema, which `create table if not exists`
in schema.sql leaves untouched. Keep this in sync with schema.sql."""
import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Every column the app reads, so a table from an older schema gets whatever it
# lacks. Added columns are nullable: rows that predate them have no value.
COLUMNS = {
    "contributors": [
        "display_name text", "email text", "password_hash text",
        "role text not null default 'contributor'", "native_dialect text",
        "created_at timestamptz default now()",
    ],
    "dialects": [
        "name text", "iso_code text", "region text", "script text",
        "endangerment_status text", "description text", "asr_language text",
        "created_at timestamptz default now()",
    ],
    "recordings": [
        "title text", "audio_url text", "storage_path text", "duration_seconds numeric",
        "dialect_id uuid", "contributor_id uuid", "speaker_name text",
        "speaker_age_group text", "genre text", "recorded_place text", "recorded_at date",
        "consent_public boolean not null default false",
        "consent_ai_training boolean not null default false",
        "licence text default 'CC-BY-NC-4.0'", "status text not null default 'uploaded'",
        "notes text", "created_at timestamptz default now()",
    ],
    "segments": [
        "recording_id uuid", "seq int", "start_ms int", "end_ms int", "asr_text text",
        "corrected_text text", "transliteration text", "translation_en text",
        "speaker_label text", "verified_by uuid", "verified_at timestamptz",
        "embedding vector(384)",
    ],
    "tags": ["label text", "category text"],
    "jobs": [
        "recording_id uuid", "kind text not null default 'transcribe'",
        "status text not null default 'queued'", "progress int default 0", "error text",
        "created_at timestamptz default now()", "updated_at timestamptz default now()",
    ],
}

# An older schema used 768-dim embeddings; the model produces 384. Only
# switch while no embeddings are stored, since the conversion would lose them.
FIX_EMBEDDING_DIM = """
do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'segments'::regclass and attname = 'embedding'
      and format_type(atttypid, atttypmod) <> 'vector(384)'
  ) and not exists (select 1 from segments where embedding is not null) then
    alter table segments alter column embedding type vector(384);
  end if;
end $$
"""


def statements() -> list[str]:
    stmts = ["create extension if not exists vector"]
    for table, cols in COLUMNS.items():
        stmts += [f"alter table if exists {table} add column if not exists {c}" for c in cols]
    stmts.append(FIX_EMBEDDING_DIM)
    return stmts


def run(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            for stmt in statements():
                conn.execute(text(stmt))
        logger.info("Startup migrations applied")
    except Exception:
        # Don't take the API down; /health/db shows what's wrong.
        logger.exception("Startup migrations failed")
