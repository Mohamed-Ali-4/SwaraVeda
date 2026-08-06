import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "recordings"

    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    DIARIZATION_ENABLED: bool = False
    HF_TOKEN: str = ""

    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    EMBEDDING_DIMENSION: int = 384

    POLL_INTERVAL: int = 5
    TEMP_DIR: str = str(Path.home() / ".swaraveda" / "tmp")


settings = WorkerSettings()
os.makedirs(settings.TEMP_DIR, exist_ok=True)
