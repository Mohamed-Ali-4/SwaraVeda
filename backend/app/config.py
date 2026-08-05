from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_BUCKET: str = "recordings"
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 10080
    CORS_ORIGINS: str = "http://localhost:5173"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
