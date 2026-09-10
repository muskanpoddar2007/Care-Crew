"""Doctor-facing routes. Currently just a read-only appointments list, scoped
to the doctor's own department — appointments aren't assigned to a specific
doctor yet (no such field exists), so this is a department-wide view rather
than a personal one. Built for the bot's "today's appointments" intent."""
from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.core.responses import ok, AppError
from app.models.user import User, UserRole
from app.models.appointment import appointment_store

router = APIRouter(prefix="/api/doctors", tags=["doctor"])


@router.get("/me/appointments")
def list_department_appointments(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.doctor:
        raise AppError(403, "Doctor access only")

    dept = current_user.department
    dept_str = (dept or "").strip().lower()
    is_emergency_doc = dept_str in {"emergency", "emergency medicine", "casualty"}

    mine = [
        a for a in appointment_store.all()
        if (a.doctor_id == current_user.id)
        or not dept
        or (a.department and a.department.lower() == dept_str)
        or (a.is_sos and is_emergency_doc)
        or (a.department and a.department.lower() in {"emergency", "emergency medicine", "casualty"})
    ]
    mine.sort(key=lambda a: a.created_at, reverse=True)
    return ok(data=[a.model_dump() for a in mine])


@router.get("/me/notifications")
def list_doctor_notifications(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.doctor:
        raise AppError(403, "Doctor access only")

    dept = current_user.department
    dept_str = (dept or "").strip().lower()
    is_emergency_doc = dept_str in {"emergency", "emergency medicine", "casualty"}

    sos_appts = [
        a for a in appointment_store.all()
        if a.is_sos and (
            a.doctor_id == current_user.id
            or not dept
            or (a.department and a.department.lower() == dept_str)
            or is_emergency_doc
            or (a.department and a.department.lower() in {"emergency", "emergency medicine", "casualty"})
        )
    ]
    sos_appts.sort(key=lambda a: a.created_at, reverse=True)

    notifications = [
        {
            "id": f"notif_sos_{a.id}",
            "type": "sos",
            "is_urgent": True,
            "title": "Immediate attention required",
            "message": f"EMERGENCY SOS: Patient {a.patient_name or 'Unknown'} requested immediate medical assistance. Auto-confirmed appointment #{a.id}.",
            "appointment_id": a.id,
            "patient_id": a.patient_id,
            "patient_name": a.patient_name,
            "created_at": a.created_at.isoformat(),
        }
        for a in sos_appts
    ]

    return ok(data={"notifications": notifications, "urgent_count": len(notifications)})

