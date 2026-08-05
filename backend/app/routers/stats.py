from fastapi import APIRouter, Depends
from sqlmodel import Session
from sqlalchemy import text

from app.db import get_session

router = APIRouter(tags=["stats"])


@router.get("/stats")
def stats(session: Session = Depends(get_session)):
    """Powers the dashboard your frontend teammates will build."""
    rows = session.exec(text("""
        select
          (select count(*) from recordings) as recordings,
          (select count(*) from recordings where status = 'verified') as verified_recordings,
          (select count(*) from segments) as segments,
          (select count(*) from segments where verified_at is not null) as verified_segments,
          (select count(*) from dialects) as dialects,
          (select count(*) from contributors) as contributors,
          (select coalesce(sum(duration_seconds), 0) from recordings) as total_seconds
    """)).mappings().first()
    return dict(rows)
