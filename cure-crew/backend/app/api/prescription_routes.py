"""Prescription routes — upload/scan (Phase 2)."""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.responses import AppError, ok
from app.models.prescription import Prescription, PrescriptionStatus, prescription_store
from app.models.user import User
from app.services import ocr_service

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])

_ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
_MAX_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _save_upload(filename: str, content: bytes) -> tuple[str, str]:
    """Validates type + size, saves the file. Returns (document_url, document_type)."""
    ext = Path(filename or "").suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "Unsupported file type",
            f"allowed types: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )
    if len(content) > _MAX_BYTES:
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "File too large",
            f"max size is {settings.MAX_UPLOAD_SIZE_MB}MB",
        )

    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / stored_name).write_bytes(content)

    return f"/uploads/{stored_name}", ext.lstrip(".")


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_prescription(
    file: Optional[UploadFile] = File(None),
    doctor_name: Optional[str] = Form(None),
    doctor_specialization: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
):
    if file is None or not file.filename:
        raise AppError(status.HTTP_400_BAD_REQUEST, "File is required")

    content = await file.read()
    document_url, document_type = _save_upload(file.filename, content)

    presc = Prescription(
        id=str(uuid.uuid4())[:8],
        patient_id=current_user.id,
        doctor_name=doctor_name,
        doctor_specialization=doctor_specialization,
        document_url=document_url,
        document_type=document_type,
        status=PrescriptionStatus.ongoing,
    )
    prescription_store.save(presc.id, presc)

    return ok(data=presc.model_dump(mode="json"), message="Prescription uploaded successfully")


@router.post("/scan", status_code=status.HTTP_201_CREATED)
async def scan_prescription(
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
):
    """Camera-capture flow — same file handling as /upload, plus a dummy OCR pass
    (app/services/ocr_service.py) to prefill doctor/medicine fields."""
    if file is None or not file.filename:
        raise AppError(status.HTTP_400_BAD_REQUEST, "File is required")

    content = await file.read()
    document_url, document_type = _save_upload(file.filename, content)

    extracted = ocr_service.extract_prescription_data(file.filename, file.content_type)

    presc = Prescription(
        id=str(uuid.uuid4())[:8],
        patient_id=current_user.id,
        doctor_name=extracted.get("doctor_name"),
        doctor_specialization=extracted.get("doctor_specialization"),
        document_url=document_url,
        document_type=document_type,
        status=PrescriptionStatus.ongoing,
        medicines=extracted.get("medicines") or [],
        doctor_instructions=extracted.get("doctor_instructions"),
        precautions=extracted.get("precautions"),
    )
    prescription_store.save(presc.id, presc)

    return ok(data=presc.model_dump(mode="json"), message="Prescription scanned and processed successfully")
