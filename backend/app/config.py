from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", str_strip_whitespace=True)

    DATABASE_URL: str
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "recordings"
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 10080
    CORS_ORIGINS: str = "http://localhost:5173"

    # Comma-separated emails that are made admin when they register or log in.
    ADMIN_EMAILS: str = ""

    # Hosted NLP. With GROQ_API_KEY set, the API transcribes and translates
    # itself; without it, transcription jobs wait for the local ML worker.
    GROQ_API_KEY: str = ""
    # Any OpenAI-compatible endpoint works, e.g. a self-hosted Whisper server.
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_ASR_MODEL: str = "whisper-large-v3"
    GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"
    # Embeddings for semantic search come from Hugging Face Inference.
    HF_TOKEN: str = ""
    HF_INFERENCE_URL: str = "https://router.huggingface.co/hf-inference"
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    # Largest upload the pipeline downloads, and largest file (after
    # pre-processing) sent to the transcription service.
    MAX_DOWNLOAD_MB: int = 200
    MAX_AUDIO_MB: int = 25

    @property
    def cors_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()}


settings = Settings()
