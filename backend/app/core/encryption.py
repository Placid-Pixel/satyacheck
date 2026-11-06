from cryptography.fernet import Fernet, MultiFernet
import os
from pathlib import Path
from app.core.config import settings

def _build_multi_fernet() -> MultiFernet:
    keys = []
    # Primary active key
    primary = settings.FERNET_KEY.encode() if isinstance(settings.FERNET_KEY, str) else settings.FERNET_KEY
    keys.append(Fernet(primary))
    
    # Old keys for rotation backward compatibility
    old_keys_str = getattr(settings, "FERNET_OLD_KEYS", "") or ""
    if old_keys_str:
        for k in old_keys_str.split(","):
            k_clean = k.strip()
            if k_clean:
                try:
                    keys.append(Fernet(k_clean.encode() if isinstance(k_clean, str) else k_clean))
                except Exception:
                    pass
    return MultiFernet(keys)

# Initialize cipher with MultiFernet (supports key rotation)
cipher = _build_multi_fernet()

def encrypt_bytes(data: bytes) -> bytes:
    return cipher.encrypt(data)

def decrypt_bytes(token: bytes) -> bytes:
    return cipher.decrypt(token)

def save_encrypted_file(file_path: Path, data: bytes) -> None:
    encrypted = encrypt_bytes(data)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(encrypted)

def read_encrypted_file(file_path: Path) -> bytes:
    with open(file_path, "rb") as f:
        encrypted = f.read()
    return decrypt_bytes(encrypted)
