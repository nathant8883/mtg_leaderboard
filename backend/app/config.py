from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # MongoDB settings
    mongodb_url: str = "mongodb://localhost:27017"
    database_name: str = "mtg_leaderboard"

    # API settings
    api_title: str = "MTG Commander Leaderboard API"
    api_version: str = "1.0.0"
    api_description: str = "API for tracking MTG Commander games and leaderboards"

    # CORS settings
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Google OAuth settings
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    # JWT settings
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440  # 24 hours

    # Frontend URL for redirects after OAuth
    frontend_url: str = "http://localhost:5173"

    # Development settings
    environment: str = "development"  # development or production

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
