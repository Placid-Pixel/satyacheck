import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional
from cryptography.fernet import Fernet

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

def _get_or_generate_fernet_key() -> str:
    env_key = os.getenv("FERNET_KEY")
    if env_key:
        return env_key.strip()
    key_file = STORAGE_DIR / ".fernet_key"
    if key_file.exists():
        try:
            return key_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    new_key = Fernet.generate_key().decode()
    try:
        key_file.write_text(new_key, encoding="utf-8")
    except Exception:
        pass
    return new_key

def _get_or_generate_secret_key() -> str:
    env_sec = os.getenv("SECRET_KEY")
    if env_sec:
        return env_sec.strip()
    sec_file = STORAGE_DIR / ".secret_key"
    if sec_file.exists():
        try:
            return sec_file.read_text(encoding="utf-8").strip()
        except Exception:
            pass
    new_sec = secrets.token_urlsafe(32)
    try:
        sec_file.write_text(new_sec, encoding="utf-8")
    except Exception:
        pass
    return new_sec

class Settings(BaseSettings):
    PROJECT_NAME: str = "SatyaCheck — AICTE Trust Layer"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    SECRET_KEY: str = _get_or_generate_secret_key()
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    FERNET_KEY: str = _get_or_generate_fernet_key()
    FERNET_OLD_KEYS: str = os.getenv("FERNET_OLD_KEYS", "")
    
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

