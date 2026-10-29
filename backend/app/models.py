from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Contributor(SQLModel, table=True):
    __tablename__ = "contributors"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    display_name: str
    email: str = Field(unique=True, index=True)
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    password_hash: str
    role: str = "contributor"
    native_dialect: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Dialect(SQLModel, table=True):
    __tablename__ = "dialects"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[str] = None
    description: Optional[str] = None
    asr_language: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Recording(SQLModel, table=True):
    __tablename__ = "recordings"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    audio_url: Optional[str] = None
    storage_path: Optional[str] = None
    duration_seconds: Optional[Decimal] = None
    dialect_id: Optional[UUID] = Field(default=None, foreign_key="dialects.id")
    contributor_id: Optional[UUID] = Field(default=None, foreign_key="contributors.id")
    speaker_name: Optional[str] = None
    speaker_age_group: Optional[str] = None
    genre: Optional[str] = None
    recorded_place: Optional[str] = None
    recorded_at: Optional[date] = None
    consent_public: bool = False
    consent_ai_training: bool = False
    licence: str = "CC-BY-NC-4.0"
    status: str = "uploaded"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)


class Segment(SQLModel, table=True):
    __tablename__ = "segments"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    recording_id: UUID = Field(foreign_key="recordings.id", index=True)
    seq: int
    start_ms: int
    end_ms: int
    asr_text: Optional[str] = None
    corrected_text: Optional[str] = None
    transliteration: Optional[str] = None
    translation_en: Optional[str] = None
    speaker_label: Optional[str] = None
    verified_by: Optional[UUID] = Field(default=None, foreign_key="contributors.id")
    verified_at: Optional[datetime] = None


class Tag(SQLModel, table=True):
    __tablename__ = "tags"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    label: str = Field(unique=True)
    category: Optional[str] = None


class RecordingTag(SQLModel, table=True):
    __tablename__ = "recording_tags"
    recording_id: UUID = Field(foreign_key="recordings.id", primary_key=True)
    tag_id: UUID = Field(foreign_key="tags.id", primary_key=True)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    recording_id: Optional[UUID] = Field(default=None, foreign_key="recordings.id")
    kind: str = "transcribe"
    status: str = "queued"
    progress: int = 0
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
