"""
settings.py — Application Configuration

Reads all environment variables from .env using Pydantic BaseSettings.
Supports both OpenAI and Azure OpenAI via the LLM_PROVIDER flag.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """
    Central configuration object.
    All values are read from the .env file in the backend directory.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Project Intelligence Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── LLM Provider ─────────────────────────────────────────────────────
    # "openai" or "azure"
    LLM_PROVIDER: str = "openai"

    # ── OpenAI ───────────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"

    # ── Azure OpenAI ─────────────────────────────────────────────────────
    AOAI_CHAT_KEY: str = ""
    AOAI_CHAT_ENDPOINT: str = ""
    AOAI_CHAT_DEPLOYMENT: str = ""
    AOAI_API_VERSION_GPT: str = "2024-08-01-preview"

    # Legacy / alias properties
    @property
    def AZURE_OPENAI_API_KEY(self) -> str:
        return self.AOAI_CHAT_KEY

    @property
    def AZURE_OPENAI_ENDPOINT(self) -> str:
        return self.AOAI_CHAT_ENDPOINT

    @property
    def AZURE_OPENAI_DEPLOYMENT(self) -> str:
        return self.AOAI_CHAT_DEPLOYMENT or "gpt-4o"

    @property
    def AZURE_OPENAI_API_VERSION(self) -> str:
        return self.AOAI_API_VERSION_GPT

    # ── MongoDB ───────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "project_intelligence"

    # ── ChromaDB ──────────────────────────────────────────────────────────
    CHROMADB_PATH: str = "./chroma_store"

    # ── GitHub ────────────────────────────────────────────────────────────
    GITHUB_PAT: str = ""

    # ── JWT Auth ──────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS_ORIGINS into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """
    Return a cached Settings instance.
    Using lru_cache ensures the .env file is only read once.
    """
    return Settings()
