from datetime import date, datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr


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


class DialectIn(BaseModel):
    name: str
    iso_code: Optional[str] = None
    region: Optional[str] = None
    script: Optional[str] = None
    endangerment_status: Optional[str] = None
    description: Optional[str] = None


class RecordingIn(BaseModel):
    title: str
    storage_path: Optional[str] = None
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    dialect_id: Optional[UUID] = None
    speaker_name: Optional[str] = None
    speaker_age_group: Optional[str] = None
    genre: Optional[str] = None
    recorded_place: Optional[str] = None
    recorded_at: Optional[date] = None
    consent_public: bool = False
    consent_ai_training: bool = False
    notes: Optional[str] = None


class RecordingPatch(BaseModel):
    title: Optional[str] = None
    dialect_id: Optional[UUID] = None
    genre: Optional[str] = None
    speaker_name: Optional[str] = None
    consent_public: Optional[bool] = None
    consent_ai_training: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None


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


class SearchHit(BaseModel):
    segment_id: UUID
    recording_id: UUID
    recording_title: str
    seq: int
    start_ms: int
    end_ms: int
    text: Optional[str]
    score: float


class Page(BaseModel):
    items: List[dict]
    total: int
    page: int
    page_size: int
