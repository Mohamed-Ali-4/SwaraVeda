from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr


class RoleEnum(str, Enum):
    contributor = "contributor"
    verifier = "verifier"
    admin = "admin"


class RecordingStatus(str, Enum):
    uploaded = "uploaded"
    transcribing = "transcribing"
    transcribed = "transcribed"
    verified = "verified"


class EndangermentStatus(str, Enum):
    safe = "safe"
    vulnerable = "vulnerable"
    definitely_endangered = "definitely endangered"
    severely_endangered = "severely endangered"
    critically_endangered = "critically endangered"


class GenreEnum(str, Enum):
    conversation = "conversation"
    narrative = "narrative"
    song = "song"
    prayer = "prayer"
    proverb = "proverb"
    other = "other"


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


# ──── Auth ────

class RegisterIn(BaseModel):
    display_name: str
    email: EmailStr
    password: str
    native_dialect: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    display_name: str
    role: str


class ProfileOut(BaseModel):
    id: UUID
    display_name: str
    email: str
    role: str
    native_dialect: Optional[str] = None


class ProfilePatch(BaseModel):
    display_name: Optional[str] = None
    native_dialect: Optional[str] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


# ──── Dialects ────

class DialectIn(BaseModel):
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[EndangermentStatus] = None
    description: Optional[str] = None


class DialectOut(BaseModel):
    id: UUID
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──── Recordings ────

class RecordingIn(BaseModel):
    title: str
    storage_path: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    dialect_id: Optional[UUID] = None
    speaker_name: Optional[str] = None
    speaker_age_group: Optional[str] = None
    genre: Optional[GenreEnum] = None
    recorded_place: Optional[str] = None
    recorded_at: Optional[date] = None
    consent_public: bool = False
    consent_ai_training: bool = False
    notes: Optional[str] = None


class RecordingPatch(BaseModel):
    title: Optional[str] = None
    dialect_id: Optional[UUID] = None
    genre: Optional[GenreEnum] = None
    speaker_name: Optional[str] = None
    consent_public: Optional[bool] = None
    consent_ai_training: Optional[bool] = None
    status: Optional[RecordingStatus] = None
    notes: Optional[str] = None


class RecordingOut(BaseModel):
    id: UUID
    title: str
    audio_url: Optional[str] = None
    storage_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    dialect_id: Optional[UUID] = None
    contributor_id: Optional[UUID] = None
    speaker_name: Optional[str] = None
    speaker_age_group: Optional[str] = None
    genre: Optional[str] = None
    recorded_place: Optional[str] = None
    recorded_at: Optional[date] = None
    consent_public: bool
    consent_ai_training: bool
    licence: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SegmentOut(BaseModel):
    id: UUID
    recording_id: UUID
    seq: int
    start_ms: int
    end_ms: int
    asr_text: Optional[str] = None
    corrected_text: Optional[str] = None
    transliteration: Optional[str] = None
    translation_en: Optional[str] = None
    speaker_label: Optional[str] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RecordingDetail(BaseModel):
    recording: RecordingOut
    segments: List[SegmentOut]


class SegmentPatch(BaseModel):
    corrected_text: Optional[str] = None
    transliteration: Optional[str] = None
    translation_en: Optional[str] = None
    speaker_label: Optional[str] = None


class UploadUrlIn(BaseModel):
    filename: str
    content_type: str = "audio/webm"


class UploadUrlOut(BaseModel):
    upload_url: str
    storage_path: str
    token: Optional[str] = None


# ──── Search ────

class SearchHit(BaseModel):
    segment_id: UUID
    recording_id: UUID
    recording_title: str
    seq: int
    start_ms: int
    end_ms: int
    text: Optional[str] = None
    score: float


class SearchResult(BaseModel):
    query: str
    hits: List[SearchHit]


# ──── Tags ────

class TagIn(BaseModel):
    label: str
    category: Optional[str] = None


class TagOut(BaseModel):
    id: UUID
    label: str
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RecordingTagIn(BaseModel):
    tag_id: UUID


# ──── Jobs ────

class JobOut(BaseModel):
    id: UUID
    recording_id: Optional[UUID] = None
    kind: str
    status: str
    progress: int
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──── Stats ────

class StatsOut(BaseModel):
    recordings: int
    verified_recordings: int
    segments: int
    verified_segments: int
    dialects: int
    contributors: int
    total_seconds: float


# ──── Pagination ────

class Page(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
