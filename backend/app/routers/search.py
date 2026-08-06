from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from sqlalchemy import text

from app.db import get_session
from app.schemas import SearchResult

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResult)
def search(
    q: str = Query(..., min_length=1),
    dialect_id: Optional[UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    sql = """
        select s.id as segment_id, s.recording_id, r.title as recording_title,
               s.seq, s.start_ms, s.end_ms,
               coalesce(s.corrected_text, s.asr_text) as text,
               ts_rank(
                 to_tsvector('simple', coalesce(s.corrected_text, s.asr_text, '')),
                 plainto_tsquery('simple', :q)
               ) as score
        from segments s
        join recordings r on r.id = s.recording_id
        where to_tsvector('simple', coalesce(s.corrected_text, s.asr_text, ''))
              @@ plainto_tsquery('simple', :q)
          and (:dialect_id::uuid is null or r.dialect_id = :dialect_id::uuid)
        order by score desc
        limit :limit
    """
    rows = session.execute(
        text(sql), {"q": q, "dialect_id": str(dialect_id) if dialect_id else None, "limit": limit}
    ).mappings().all()
    return {"query": q, "hits": [dict(r) for r in rows]}
