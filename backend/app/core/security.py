from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
import re
import hashlib
import jwt
from app.core.config import settings

# Roles
ROLE_INSTITUTION = "INSTITUTION_USER"
ROLE_SCRUTINY = "SCRUTINY_OFFICER"
ROLE_SENIOR = "SENIOR_AUTHORITY"
ROLE_ADMIN = "ADMIN"

ALL_ROLES = [ROLE_INSTITUTION, ROLE_SCRUTINY, ROLE_SENIOR, ROLE_ADMIN]

def get_password_hash(password: str) -> str:
    # Use sha256 + salt for robust portability without external C-extensions
    salt = settings.SECRET_KEY[:16]
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if get_password_hash(plain_password) == hashed_password:
        return True
    # Backward compatibility for existing databases during key rotation
    legacy_salt = "satyacheck-super"
    if hashlib.sha256(f"{legacy_salt}{plain_password}".encode("utf-8")).hexdigest() == hashed_password:
        return True
    return False

def create_access_token(subject: Union[str, Any], role: str, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "role": role,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def mask_sensitive_value(value: Optional[str], field_type: str = "generic") -> Optional[str]:
    """Masks PAN, Aadhaar, Phone, Email for non-authorized roles."""
    if not value or not settings.MASK_SENSITIVE_DATA:
        return value
    
    val = str(value).strip()
    
    # Aadhaar (12 digits, often with spaces/dashes)
    if field_type == "aadhaar" or re.match(r"^\d{4}[ -]?\d{4}[ -]?\d{4}$", val):
        clean = re.sub(r"[ -]", "", val)
        return f"XXXX-XXXX-{clean[-4:]}"
    
    # PAN (5 letters, 4 digits, 1 letter)
    if field_type == "pan" or re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$", val, re.IGNORECASE):
        return f"XXXXX{val[5:9]}X"
    
    # Phone number
    if field_type == "phone" or re.match(r"^\+?[0-9]{10,12}$", val):
        return f"+91-XXXXX-{val[-4:]}"
        
    # Email
    if field_type == "email" or "@" in val:
        parts = val.split("@")
        name = parts[0]
        masked_name = name[:2] + "***" if len(name) > 2 else "***"
        return f"{masked_name}@{parts[1]}"
        
    return val
