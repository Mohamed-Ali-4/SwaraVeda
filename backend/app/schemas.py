from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.phone import normalize_phone


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
    display_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=8, max_length=128)
    native_dialect: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone(v) if v and v.strip() else None


class LoginIn(BaseModel):
    # An email address or a mobile number.
    email: str = Field(min_length=3, max_length=254)
    password: str


class GoogleLoginIn(BaseModel):
    # The ID token from Google Identity Services.
    credential: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    display_name: str
    role: str


class ProfileOut(BaseModel):
    id: UUID
    display_name: str
    email: str
    phone: Optional[str] = None
    role: str
    native_dialect: Optional[str] = None


class ProfilePatch(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: Optional[str]) -> Optional[str]:
        return normalize_phone(v) if v and v.strip() else None

    native_dialect: Optional[str] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


# ──── Dialects ────

class DialectIn(BaseModel):
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[EndangermentStatus] = None
    description: Optional[str] = None
    # Whisper language code to transcribe with (e.g. "kn" for a Kannada-script
    # dialect). Left empty, the language is auto-detected.
    asr_language: Optional[str] = None


class DialectPatch(BaseModel):
    name: Optional[str] = None
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[EndangermentStatus] = None
    description: Optional[str] = None
    asr_language: Optional[str] = None


class DialectOut(BaseModel):
    id: UUID
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[str] = None
    description: Optional[str] = None
    asr_language: Optional[str] = None
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
    latest_job: Optional["JobOut"] = None


class SegmentPatch(BaseModel):
    corrected_text: Optional[str] = None
    transliteration: Optional[str] = None
    translation_en: Optional[str] = None
    speaker_label: Optional[str] = None


class TranslateIn(BaseModel):
    # Unsaved text from the editor; defaults to the segment's stored text.
    text: Optional[str] = None


class TranslationOut(BaseModel):
    translation_en: Optional[str] = None
    transliteration: Optional[str] = None


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
    audio_url: Optional[str] = None
    dialect_name: Optional[str] = None
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


class NLPStatus(BaseModel):
    transcription: bool
    translation: bool
    semantic_search: bool


class ReviewItem(BaseModel):
    segment: SegmentOut
    recording_id: UUID
    recording_title: str
    audio_url: Optional[str] = None
    dialect_name: Optional[str] = None


class ReviewQueue(BaseModel):
    counts: dict[str, int]
    items: List[ReviewItem]


# ──── Admin ────

class AdminUserOut(BaseModel):
    id: UUID
    display_name: str
    email: str
    phone: Optional[str] = None
    role: str
    native_dialect: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RolePatch(BaseModel):
    role: RoleEnum


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


RecordingDetail.model_rebuild()
