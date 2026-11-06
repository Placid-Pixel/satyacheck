from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, mask_sensitive_value
from app.models import User
from app.schemas import LoginRequest, Token, UserResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    access_token = create_access_token(subject=user.username, role=user.role)
    return Token(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        username=user.username,
        role=user.role,
        institution_id=user.institution_id
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
