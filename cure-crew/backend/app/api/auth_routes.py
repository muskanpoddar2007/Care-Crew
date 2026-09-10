import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.config import settings
from app.core.auth import create_access_token, get_current_user, hash_password, verify_password
from app.core.responses import AppError, ok
from app.models.user import (
    User,
    UserLogin,
    UserPublic,
    UserRegister,
    UserRole,
    get_user_by_email,
    get_user_by_identifier,
    user_store,
)

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
    abha_id = (payload.abha_id or "").strip() or None
    doctor_id = (payload.doctor_id or "").strip() or None

    if payload.role == UserRole.patient:
        if not abha_id:
            raise AppError(status.HTTP_400_BAD_REQUEST, "ABHA ID is required")
        if not re.match(r"^\d{14}$", abha_id):
            raise AppError(status.HTTP_400_BAD_REQUEST, "ABHA ID must be exactly 14 digits, numbers only")
        if not payload.consent:
            raise AppError(status.HTTP_400_BAD_REQUEST, "Consent to Terms and Conditions is required to create an account")
        if get_user_by_identifier(abha_id) is not None:
            raise AppError(status.HTTP_400_BAD_REQUEST, "ABHA ID already registered")
    else:
        if not doctor_id:
            raise AppError(status.HTTP_400_BAD_REQUEST, "Doctor ID is required")
        if get_user_by_identifier(doctor_id) is not None:
            raise AppError(status.HTTP_400_BAD_REQUEST, "Doctor ID already registered")

    if payload.email and get_user_by_email(payload.email) is not None:
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
        abha_id=abha_id if payload.role == UserRole.patient else None,
        doctor_id=doctor_id if payload.role == UserRole.doctor else None,
        photo_url=payload.photo_url,
        consent=payload.consent if payload.role == UserRole.patient else True,
        consent_at=datetime.now(timezone.utc) if (payload.role == UserRole.patient and payload.consent) else None,
    )
    user_store.save(user.id, user)

    return ok(data=_auth_payload(user), message="Registered successfully")


@router.post("/login")
def login(payload: UserLogin):
    ident = (payload.identifier or "").strip()
    is_patient = payload.role == "patient" or (not ident.startswith("DOC") and "@" not in ident)
    if is_patient:
        if not ident:
            raise AppError(status.HTTP_400_BAD_REQUEST, "ABHA ID is required")
        if not re.match(r"^\d{14}$", ident):
            raise AppError(status.HTTP_400_BAD_REQUEST, "ABHA ID must be exactly 14 digits, numbers only")

    user = get_user_by_identifier(payload.identifier)
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AppError(status.HTTP_401_UNAUTHORIZED, "Invalid ID or password")

    return ok(data=_auth_payload(user), message="Login successful")


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return ok(data=UserPublic.model_validate(current_user.model_dump()))


_ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if not file or not file.filename:
        raise AppError(status.HTTP_400_BAD_REQUEST, "File is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_AVATAR_EXTENSIONS:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported image type '{ext}'. Allowed types: {', '.join(sorted(_ALLOWED_AVATAR_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > _MAX_AVATAR_BYTES:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "File size exceeds 5 MB limit. Please choose a smaller image.",
        )

    # Basic magic byte / header sanity check
    is_valid_image = False
    if ext in {".jpg", ".jpeg"} and content.startswith(b"\xff\xd8"):
        is_valid_image = True
    elif ext == ".png" and content.startswith(b"\x89PNG\r\n\x1a\n"):
        is_valid_image = True
    elif ext == ".webp" and content.startswith(b"RIFF") and b"WEBP" in content[:16]:
        is_valid_image = True

    if not is_valid_image:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "The uploaded file is not a valid image. Allowed types: JPG, JPEG, PNG, WebP.",
        )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"avatar_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    (upload_dir / stored_name).write_bytes(content)

    current_user.photo_url = f"/uploads/{stored_name}"
    current_user.updated_at = datetime.now(timezone.utc)
    user_store.save(current_user.id, current_user)

    return ok(data=_auth_payload(current_user), message="Profile picture updated successfully")

