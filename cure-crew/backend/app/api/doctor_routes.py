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
    mine = [a for a in appointment_store.all() if not dept or a.department == dept]
    mine.sort(key=lambda a: a.created_at, reverse=True)
    return ok(data=[a.model_dump() for a in mine])
