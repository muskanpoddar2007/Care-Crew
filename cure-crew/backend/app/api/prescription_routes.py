"""Prescription routes — upload/scan (Phase 2), CRUD + filtering (Phase 3)."""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.responses import AppError, ok
from app.models.prescription import Prescription, PrescriptionStatus, prescription_store
from app.models.user import User
from app.services import ocr_service

router = APIRouter(prefix="/api/prescriptions", tags=["prescriptions"])
_VALID_SORTS = {"date_desc", "date_asc"}

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


def _own_prescriptions(patient_id: str) -> list[Prescription]:
    return [p for p in prescription_store.all() if p.patient_id == patient_id]


def _matches_search(presc: Prescription, term: str) -> bool:
    term = term.lower()
    haystacks = [presc.doctor_name or "", presc.doctor_specialization or ""]
    haystacks += [m.name for m in presc.medicines]
    return any(term in h.lower() for h in haystacks)


def _parse_date(value: str, field: str) -> datetime:
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        raise AppError(status.HTTP_400_BAD_REQUEST, f"Invalid {field}", f"expected an ISO date, got: {value!r}")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _to_summary(presc: Prescription) -> dict:
    data = presc.model_dump(
        mode="json",
        include={
            "id", "doctor_name", "doctor_specialization", "prescription_date",
            "status", "document_type", "document_url", "summary_generated",
        },
    )
    data["medicine_count"] = len(presc.medicines)
    return data


@router.get("")
def list_prescriptions(
    status_filter: Optional[str] = Query(None, alias="status"),
    doctor: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("date_desc"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    valid_statuses = {s.value for s in PrescriptionStatus}
    if status_filter is not None and status_filter not in valid_statuses:
        raise AppError(status.HTTP_400_BAD_REQUEST, "Invalid status value", f"allowed: {', '.join(sorted(valid_statuses))}")
    if sort not in _VALID_SORTS:
        raise AppError(status.HTTP_400_BAD_REQUEST, "Invalid sort value", f"allowed: {', '.join(sorted(_VALID_SORTS))}")

    start_dt = _parse_date(start_date, "start_date") if start_date else None
    end_dt = _parse_date(end_date, "end_date") if end_date else None

    items = _own_prescriptions(current_user.id)

    if status_filter is not None:
        items = [p for p in items if p.status.value == status_filter]
    if doctor:
        items = [p for p in items if doctor.lower() in (p.doctor_name or "").lower()]
    if search:
        items = [p for p in items if _matches_search(p, search)]
    if start_dt is not None:
        items = [p for p in items if p.prescription_date >= start_dt]
    if end_dt is not None:
        items = [p for p in items if p.prescription_date <= end_dt]

    items.sort(key=lambda p: p.prescription_date, reverse=(sort == "date_desc"))

    return ok(data=[_to_summary(p) for p in items], message="Prescriptions fetched successfully")


@router.get("/doctors")
def list_doctors(current_user: User = Depends(get_current_user)):
    seen: dict[tuple, dict] = {}
    for p in _own_prescriptions(current_user.id):
        if not p.doctor_name:
            continue
        key = (p.doctor_name, p.doctor_specialization)
        seen.setdefault(key, {"doctor_name": p.doctor_name, "doctor_specialization": p.doctor_specialization})

    return ok(data=list(seen.values()), message="Doctors fetched successfully")


@router.get("/{prescription_id}")
def get_prescription(prescription_id: str, current_user: User = Depends(get_current_user)):
    presc = prescription_store.get(prescription_id)
    if presc is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "Prescription not found")
    if presc.patient_id != current_user.id:
        raise AppError(status.HTTP_403_FORBIDDEN, "Not authorized to view this prescription")

    return ok(data=presc.model_dump(mode="json"), message="Prescription fetched successfully")


@router.delete("/{prescription_id}")
def delete_prescription(prescription_id: str, current_user: User = Depends(get_current_user)):
    presc = prescription_store.get(prescription_id)
    if presc is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "Prescription not found")
    if presc.patient_id != current_user.id:
        raise AppError(status.HTTP_403_FORBIDDEN, "Not authorized to delete this prescription")

    file_path = Path(settings.UPLOAD_DIR) / Path(presc.document_url).name
    file_path.unlink(missing_ok=True)
    prescription_store.delete(prescription_id)

    return ok(message="Prescription deleted successfully")
