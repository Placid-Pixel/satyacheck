import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "SatyaCheck — AICTE Trust Layer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "satyacheck-super-secret-key-aicte-sih-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    FERNET_KEY: str = os.getenv("FERNET_KEY", "E5rX0Yv1v39X8K_sPz8_jY6L4_Dq7oP2_0yT9-5V4Wc=")  # Base64 32 bytes
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'satyacheck.db'}")
    
    # Document storage
    DATA_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = BASE_DIR / "storage" / "uploads"
    SYNTHETIC_DIR: Path = BASE_DIR / "storage" / "synthetic"
    PROCESSED_DIR: Path = BASE_DIR / "storage" / "processed"
    
    # AI & Fallback
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    USE_OFFLINE_DETECTORS: bool = os.getenv("USE_OFFLINE_DETECTORS", "false").lower() in ("true", "1", "yes")
    AGENT_MAX_STEPS: int = int(os.getenv("AGENT_MAX_STEPS", "12"))
    AGENT_TIMEOUT_SECONDS: int = int(os.getenv("AGENT_TIMEOUT_SECONDS", "60"))
    AGENT_RETRY_ATTEMPTS: int = int(os.getenv("AGENT_RETRY_ATTEMPTS", "2"))
    
    # Retention & Masking
    DATA_RETENTION_DAYS: int = 365
    MASK_SENSITIVE_DATA: bool = True
    
    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

# Ensure directories exist
for path in [settings.DATA_DIR, settings.UPLOAD_DIR, settings.SYNTHETIC_DIR, settings.PROCESSED_DIR]:
    path.mkdir(parents=True, exist_ok=True)
