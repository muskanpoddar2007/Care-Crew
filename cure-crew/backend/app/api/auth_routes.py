"""Auth routes for the prescription module — register/login/me."""
import uuid

from fastapi import APIRouter, Depends, status

from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.core.responses import AppError, ok
from app.models.user import User, UserLogin, UserPublic, UserRegister, get_user_by_email, user_store

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_payload(user: User) -> dict:
    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserPublic.model_validate(user.model_dump()),
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister):
    if get_user_by_email(payload.email) is not None:
        raise AppError(status.HTTP_400_BAD_REQUEST, "Email already registered")

    user = User(
        id=str(uuid.uuid4())[:8],
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        department=payload.department,
        specialty=payload.specialty,
        photo_url=payload.photo_url,
    )
    user_store.save(user.id, user)

    return ok(data=_auth_payload(user), message="Registered successfully")


@router.post("/login")
def login(payload: UserLogin):
    user = get_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AppError(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    return ok(data=_auth_payload(user), message="Login successful")


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return ok(data=UserPublic.model_validate(current_user.model_dump()))
