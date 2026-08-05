from sqlmodel import create_engine, Session
from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=2)


def get_session():
    with Session(engine) as session:
        yield session
