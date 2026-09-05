"""Doctor directory — public read endpoints over the static doctors.csv
dataset (app/services/doctor_directory.py loads + caches it once at import
time). No auth required; this is reference data, not per-user state.

Shares the /api/doctors prefix with app/api/doctor_routes.py (the doctor's
own department appointments view — GET /api/doctors/me/appointments, a
3-segment path, so it never collides with the 2-segment routes below).
/specializations and /cities ARE 2-segment siblings of /{doctor_id} though,
so both are declared first: FastAPI matches routes in declaration order,
and a path param would otherwise swallow the literal path.
"""
from typing import Optional

from fastapi import APIRouter, Query

from app.core.responses import ok, AppError
from app.services import doctor_directory

router = APIRouter(prefix="/api/doctors", tags=["doctor-directory"])


@router.get("/specializations")
def get_specializations():
    return ok(data=doctor_directory.list_specializations())


@router.get("/cities")
def get_cities():
    return ok(data=doctor_directory.list_cities())


@router.get("")
def get_doctors(
    specialization: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Free-text search over name / specialty / hospital"),
    max_fees: Optional[int] = Query(None, ge=0),
    min_exp: Optional[int] = Query(None, ge=0),
    sort: Optional[str] = Query(None, description="fees | experience_years | doctor_name — prefix with - to reverse"),
    limit: Optional[int] = Query(None, ge=1, le=200),
):
    doctors = doctor_directory.list_doctors(
        specialization=specialization,
        city=city,
        q=q,
        max_fees=max_fees,
        min_exp=min_exp,
        sort=sort,
        limit=limit,
    )
    return ok(data=[d.model_dump() for d in doctors])


@router.get("/{doctor_id}")
def get_doctor(doctor_id: str):
    doctor = doctor_directory.get_doctor(doctor_id)
    if doctor is None:
        raise AppError(404, "Doctor not found")
    return ok(data=doctor.model_dump())
