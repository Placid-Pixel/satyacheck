from cryptography.fernet import Fernet
import os
from pathlib import Path
from app.core.config import settings

# Initialize cipher
cipher = Fernet(settings.FERNET_KEY.encode() if isinstance(settings.FERNET_KEY, str) else settings.FERNET_KEY)

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
