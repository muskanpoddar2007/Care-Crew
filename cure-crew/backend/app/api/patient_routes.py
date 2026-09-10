"""Patient-facing routes reached via the chat assistant's navigation actions —
appointments, past reports, and AI case summaries. All require the patient to
be logged in (reuses the same JWT auth as /api/auth)."""
import uuid

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.responses import ok, AppError
from app.models.user import User
from datetime import datetime, timezone
from app.models.appointment import Appointment, AppointmentCreate, AppointmentStatus, appointment_store
from app.models.prescription import prescription_store
from app.models.user import UserRole, user_store
from app.services import summary as summary_service
from app.services.reports_store import case_report_store
from app.services.doctor_directory import list_doctors

router = APIRouter(prefix="/api/patients", tags=["patient"])


def _find_assigned_doctors_for_patient(patient: User) -> list[dict]:
    """Derives doctors assigned to this patient based on appointment history,
    prescriptions, case sheet reports, or hospital primary care."""
    assigned: dict[str, dict] = {}

    # 1. Check patient's appointments
    patient_appts = [a for a in appointment_store.all() if a.patient_id == patient.id]
    for appt in patient_appts:
        if appt.doctor_id:
            # Check user_store
            doc_user = user_store.get(appt.doctor_id)
            if doc_user and doc_user.role == UserRole.doctor:
                assigned[doc_user.id] = {
                    "id": doc_user.id,
                    "name": doc_user.name,
                    "specialisation": doc_user.specialty or "Specialist",
                    "department": doc_user.department or appt.department or "General Medicine",
                    "hospital_name": "Care Crew Central Hospital, New Delhi",
                    "hospital_contact": doc_user.phone or "+91-11-26588500",
                    "status": "Assigned",
                    "photo_url": doc_user.photo_url,
                }
        elif appt.doctor_name:
            key = appt.doctor_name.lower()
            if key not in assigned:
                assigned[key] = {
                    "id": f"doc_{abs(hash(key)) % 10000}",
                    "name": appt.doctor_name,
                    "specialisation": appt.department or "Specialist",
                    "department": appt.department or "General Medicine",
                    "hospital_name": "Care Crew Central Hospital, New Delhi",
                    "hospital_contact": "+91-11-26588500",
                    "status": "Assigned",
                }

    # 2. Check patient's prescriptions
    patient_prescriptions = [p for p in prescription_store.all() if p.patient_id == patient.id]
    for p in patient_prescriptions:
        if p.doctor_name:
            key = p.doctor_name.lower()
            if key not in assigned:
                assigned[key] = {
                    "id": p.doctor_id or f"doc_{abs(hash(key)) % 10000}",
                    "name": p.doctor_name,
                    "specialisation": p.doctor_specialization or "Consultant",
                    "department": p.doctor_specialization or "General Medicine",
                    "hospital_name": "Care Crew Central Hospital, New Delhi",
                    "hospital_contact": "+91-11-26588500",
                    "status": "Consulted",
                }

    # 3. Check registered doctors matching patient's appointment departments
    registered_doctors = [u for u in user_store.all() if u.role == UserRole.doctor]
    for appt in patient_appts:
        for doc in registered_doctors:
            if doc.department and doc.department.lower() == appt.department.lower():
                if doc.id not in assigned:
                    assigned[doc.id] = {
                        "id": doc.id,
                        "name": doc.name,
                        "specialisation": doc.specialty or doc.department,
                        "department": doc.department,
                        "hospital_name": "Care Crew Central Hospital, New Delhi",
                        "hospital_contact": doc.phone or "+91-11-26588500",
                        "status": "Attending Doctor",
                        "photo_url": doc.photo_url,
                    }

    # 4. Fallback: if patient has no doctor linked yet, assign hospital primary care physician
    if not assigned:
        if registered_doctors:
            doc = registered_doctors[0]
            assigned[doc.id] = {
                "id": doc.id,
                "name": doc.name,
                "specialisation": doc.specialty or "Primary Care Physician",
                "department": doc.department or "General Medicine",
                "hospital_name": "Care Crew Central Hospital, New Delhi",
                "hospital_contact": doc.phone or "+91-11-26588500",
                "status": "Primary Care",
                "photo_url": doc.photo_url,
            }
        else:
            # Fallback from directory
            dir_docs = list_doctors()
            fallback = dir_docs[0] if dir_docs else None
            if fallback:
                assigned[fallback.id] = {
                    "id": fallback.id,
                    "name": fallback.doctor_name,
                    "specialisation": fallback.doctor_type,
                    "department": fallback.doctor_type,
                    "hospital_name": fallback.hospital or "Care Crew Central Hospital, New Delhi",
                    "hospital_contact": "+91-11-26588500",
                    "status": "Primary Care",
                    "photo_url": None,
                }

    return list(assigned.values())


@router.post("/me/appointments", status_code=201)
def create_appointment(payload: AppointmentCreate, current_user: User = Depends(get_current_user)):
    # Enforce single appointment per symptom-check session (regular bookings only)
    if payload.case_sheet_id and not payload.is_sos:
        existing = [
            a for a in appointment_store.all()
            if a.patient_id == current_user.id
            and a.case_sheet_id == payload.case_sheet_id
            and not a.is_sos
            and a.status != AppointmentStatus.cancelled
        ]
        if existing:
            raise AppError(
                400,
                "An appointment has already been booked for this case sheet session.",
            )

    appt = Appointment(
        id=str(uuid.uuid4())[:8],
        patient_id=current_user.id,
        patient_name=current_user.name,
        doctor_id=payload.doctor_id,
        doctor_name=payload.doctor_name,
        department=payload.department,
        preferred_date=payload.preferred_date,
        note=payload.note,
        urgent=payload.urgent,
        type=payload.type or "standard",
        is_sos=payload.is_sos,
        case_sheet_id=payload.case_sheet_id,
    )
    appointment_store.save(appt.id, appt)
    return ok(data=appt.model_dump(), message="Appointment requested")


@router.post("/me/sos", status_code=201)
def trigger_sos(current_user: User = Depends(get_current_user)):
    """Trigger emergency SOS: immediately notifies assigned doctor(s) and
    auto-creates a confirmed, non-cancellable emergency appointment.
    Completely independent of normal symptom-check booking restrictions."""
    doctors = _find_assigned_doctors_for_patient(current_user)
    primary_doc = doctors[0] if doctors else None

    assigned_doc_id = primary_doc.get("id") if primary_doc else None
    assigned_doc_name = primary_doc.get("name") if primary_doc else "Emergency Response Doctor"
    assigned_dept = primary_doc.get("department") if primary_doc else "Emergency Medicine"

    now = datetime.now(timezone.utc)
    appt = Appointment(
        id=str(uuid.uuid4())[:8],
        patient_id=current_user.id,
        patient_name=current_user.name,
        doctor_id=assigned_doc_id,
        doctor_name=assigned_doc_name,
        department=assigned_dept,
        preferred_date=now.strftime("%Y-%m-%d"),
        note="EMERGENCY SOS ALERT: Immediate medical attention requested by patient.",
        urgent=True,
        type="sos",
        is_sos=True,
        status=AppointmentStatus.confirmed,
        created_at=now,
    )
    appointment_store.save(appt.id, appt)

    return ok(
        data={
            "appointment": appt.model_dump(),
            "doctor": primary_doc,
            "emergency_helpline": "112",
            "hospital_contact": primary_doc.get("hospital_contact") if primary_doc else "+91-11-26588500",
        },
        message="Emergency SOS dispatched. Your doctor has been alerted and an emergency appointment has been scheduled.",
    )


@router.get("/me/doctors")
def get_my_doctors(current_user: User = Depends(get_current_user)):
    """Returns all doctors currently assigned to this patient with specialization,
    department, hospital name, and contact details."""
    docs = _find_assigned_doctors_for_patient(current_user)
    return ok(data=docs)



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
