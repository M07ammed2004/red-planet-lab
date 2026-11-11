from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings."""

    # Server configuration
    PROJECT_NAME: str = "RED PLANET LAB API"
    VERSION: str = "0.1.0"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    DATA_RAW_DIR: Path = BASE_DIR / "data" / "raw"
    DATA_PROCESSED_DIR: Path = BASE_DIR / "data" / "processed"
    DATA_CACHE_DIR: Path = BASE_DIR / "data" / "cache"
    DATA_METADATA_DIR: Path = BASE_DIR / "data" / "metadata"

    # Limits and constraints
    MAX_SECTOR_DOWNLOAD_MB: int = 500
    MAX_CACHE_TOTAL_MB: int = 2048
    REQUEST_TIMEOUT_SECONDS: int = 30
    MAX_DOWNLOAD_RETRIES: int = 3

    # Archive endpoints
    ODE_API_BASE_URL: str = "https://ode.rsl.wustl.edu/mars2/api/v1"
    MARS_TREK_WMTS_BASE_URL: str = "https://trek.nasa.gov/tiles/Mars/EQ/"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
