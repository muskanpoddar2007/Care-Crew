"""Patient-facing routes reached via the chat assistant's navigation actions —
appointments, past reports, and AI case summaries. All require the patient to
be logged in (reuses the same JWT auth as /api/auth)."""
import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.responses import ok, AppError
from app.models.user import User
from app.models.appointment import Appointment, AppointmentCreate, appointment_store
from app.services import summary as summary_service
from app.services.reports_store import case_report_store

router = APIRouter(prefix="/api/patients", tags=["patient"])


@router.post("/me/appointments", status_code=201)
def create_appointment(payload: AppointmentCreate, current_user: User = Depends(get_current_user)):
    appt = Appointment(
        id=str(uuid.uuid4())[:8],
        patient_id=current_user.id,
        department=payload.department,
        preferred_date=payload.preferred_date,
        note=payload.note,
        urgent=payload.urgent,
    )
    appointment_store.save(appt.id, appt)
    return ok(data=appt.model_dump(), message="Appointment requested")


@router.get("/me/appointments")
def list_appointments(current_user: User = Depends(get_current_user)):
    mine = [a for a in appointment_store.all() if a.patient_id == current_user.id]
    mine.sort(key=lambda a: a.created_at, reverse=True)
    return ok(data=[a.model_dump() for a in mine])


@router.get("/me/reports")
def list_reports(current_user: User = Depends(get_current_user)):
    mine = [s for s in case_report_store.all() if s.patient_id == current_user.id]
    mine.sort(key=lambda s: s.completed_at or s.session_id, reverse=True)
    return ok(data=[s.model_dump() for s in mine])


@router.get("/me/reports/{session_id}/summary")
def report_summary(
    session_id: str,
    audience: str = Query("patient", pattern="^(patient|doctor)$"),
    current_user: User = Depends(get_current_user),
):
    sheet = case_report_store.get(session_id)
    if sheet is None or sheet.patient_id != current_user.id:
        raise AppError(404, "Report not found")
    text = summary_service.generate_summary(sheet, audience)
    return ok(data={"summary": text, "audience": audience})
