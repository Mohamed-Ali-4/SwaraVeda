from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from sqlalchemy import text

from app import nlp
from app.config import settings
from app.db import get_session
from app.schemas import SearchResult

router = APIRouter(prefix="/search", tags=["search"])

# Bind parameters use cast(... as type): SQLAlchemy doesn't recognise
# ":name::type" as a parameter.


@router.get("", response_model=SearchResult)
def search(
    q: str = Query(..., min_length=1),
    dialect_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    sql = """
        select s.id as segment_id, s.recording_id, r.title as recording_title,
               r.audio_url, d.name as dialect_name,
               s.seq, s.start_ms, s.end_ms,
               coalesce(s.corrected_text, s.asr_text) as text,
               ts_rank(
                 to_tsvector('simple', coalesce(s.corrected_text, s.asr_text, '')),
                 plainto_tsquery('simple', :q)
               ) as score
        from segments s
        join recordings r on r.id = s.recording_id
        left join dialects d on d.id = r.dialect_id
        where to_tsvector('simple', coalesce(s.corrected_text, s.asr_text, ''))
              @@ plainto_tsquery('simple', :q)
          and (cast(:dialect_id as uuid) is null or r.dialect_id = cast(:dialect_id as uuid))
        order by score desc
        limit :limit
    """
    rows = session.execute(
        text(sql), {"q": q, "dialect_id": str(dialect_id) if dialect_id else None, "limit": limit}
    ).mappings().all()
    return {"query": q, "hits": [dict(r) for r in rows]}


def _embed_query(q: str) -> list[float]:
    if nlp.embeddings_enabled():
        try:
            return nlp.embed_texts([q])[0]
        except nlp.NLPError as e:
            raise HTTPException(503, f"Semantic search is unavailable right now: {e}")
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise HTTPException(
            503, "Semantic search isn't set up on this server (HF_TOKEN is missing)."
        )
    model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return model.encode(q, normalize_embeddings=True).tolist()


@router.get("/semantic", response_model=SearchResult)
def semantic_search(
    q: str = Query(..., min_length=1),
    dialect_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    query_vec = _embed_query(q)

    sql = """
        select s.id as segment_id, s.recording_id, r.title as recording_title,
               r.audio_url, d.name as dialect_name,
               s.seq, s.start_ms, s.end_ms,
               coalesce(s.corrected_text, s.asr_text) as text,
               1 - (s.embedding <=> cast(:vec as vector)) as score
        from segments s
        join recordings r on r.id = s.recording_id
        left join dialects d on d.id = r.dialect_id
        where s.embedding is not null
          and (cast(:dialect_id as uuid) is null or r.dialect_id = cast(:dialect_id as uuid))
        order by s.embedding <=> cast(:vec as vector)
        limit :limit
    """
    rows = session.execute(
        text(sql), {
            "vec": str(query_vec),
            "dialect_id": str(dialect_id) if dialect_id else None,
            "limit": limit,
        }
    ).mappings().all()
    return {"query": q, "hits": [dict(r) for r in rows]}
