from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Enterprise RAG AI Service"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    PGVECTOR_DATABASE_URL: str = ""
    PGVECTOR_POOL_SIZE: int = 5

    # Retained for the one-time Qdrant-to-pgvector migration utility.
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "enterprise_documents"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
