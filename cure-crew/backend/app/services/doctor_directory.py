"""Doctor directory — loads app/data/doctors.csv into memory ONCE at import
time (module-level cache), same "read a static file into a module global"
pattern as services/question_tree.py's tree loading. No new DB — this is
static reference data the app only ever reads.

CSV missing or unreadable -> empty list, never crash the app over it.
"""
import csv
import re
from pathlib import Path
from typing import Optional

from app.models.doctor import Doctor
from app.data.specialty_map import specialty_for_complaint

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_CSV_PATH = _DATA_DIR / "doctors.csv"

# Common specialty spelling/variant (after strip + title-case) -> canonical
# display name shown in the directory and matched against specialty_map.
_SPECIALTY_ALIASES = {
    "Cardiology": "Cardiologist",
    "Cardiologist": "Cardiologist",
    "Cardio": "Cardiologist",
    "Pulmonology": "Pulmonologist",
    "Pulmonologist": "Pulmonologist",
    "Pulmonary": "Pulmonologist",
    "Chest": "Pulmonologist",
    "Gastroenterology": "Gastroenterologist",
    "Gastroenterologist": "Gastroenterologist",
    "Gastro": "Gastroenterologist",
    "Neurology": "Neurologist",
    "Neurologist": "Neurologist",
    "Neuro": "Neurologist",
    "Dermatology": "Dermatologist",
    "Dermatologist": "Dermatologist",
    "Derma": "Dermatologist",
    "Orthopedics": "Orthopedic",
    "Orthopaedics": "Orthopedic",
    "Orthopedic": "Orthopedic",
    "Ortho": "Orthopedic",
    "Pediatrics": "Pediatrician",
    "Paediatrics": "Pediatrician",
    "Pediatrician": "Pediatrician",
    "Peds": "Pediatrician",
    "Gynecology": "Gynecologist",
    "Gynaecology": "Gynecologist",
    "Gynecologist": "Gynecologist",
    "Gyno": "Gynecologist",
    "Ent": "ENT Specialist",
    "Ent Specialist": "ENT Specialist",
    "General Medicine": "General Physician",
    "General Physician": "General Physician",
    "Gp": "General Physician",
    "Physician": "General Physician",
}


def _normalize_fees(raw: Optional[str]) -> int:
    """"₹500" / "Rs 500" / "Rs. 500" / "500" -> 500. "Free" / blank -> 0."""
    text = str(raw or "").strip()
    if not text or text.lower() == "free":
        return 0
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


def _normalize_int(raw: Optional[str]) -> int:
    text = str(raw or "").strip()
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


def _normalize_specialty(raw: Optional[str]) -> str:
    text = str(raw or "").strip()
    if not text:
        return "General Physician"
    title = text.title()
    return _SPECIALTY_ALIASES.get(title, title)


def _row_to_doctor(index: int, row: dict) -> Doctor:
    return Doctor(
        id=f"doc_{index}",
        doctor_name=str(row.get("doctor_name") or "").strip() or "Unknown",
        doctor_type=_normalize_specialty(row.get("doctor_type")),
        experience_years=_normalize_int(row.get("experience_years")),
        fees=_normalize_fees(row.get("fees")),
        hospital=str(row.get("hospital") or "").strip() or None,
        location=str(row.get("location") or "").strip() or None,
        city=str(row.get("city") or "").strip() or None,
    )


def _load_doctors() -> list[Doctor]:
    if not _CSV_PATH.exists():
        return []
    try:
        with open(_CSV_PATH, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            return [_row_to_doctor(i, row) for i, row in enumerate(reader)]
    except Exception:
        return []


_DOCTORS: list[Doctor] = _load_doctors()
_BY_ID: dict[str, Doctor] = {d.id: d for d in _DOCTORS}

_SORT_KEYS = {
    "fees": lambda d: d.fees,
    "experience_years": lambda d: d.experience_years,
    "experience": lambda d: d.experience_years,
    "doctor_name": lambda d: d.doctor_name.lower(),
    "name": lambda d: d.doctor_name.lower(),
}


def _sort_doctors(doctors: list[Doctor], sort: Optional[str]) -> list[Doctor]:
    if not sort:
        return doctors
    reverse = sort.startswith("-")
    keyfn = _SORT_KEYS.get(sort.lstrip("-"))
    if keyfn is None:
        return doctors
    return sorted(doctors, key=keyfn, reverse=reverse)


def list_doctors(
    specialization: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    max_fees: Optional[int] = None,
    min_exp: Optional[int] = None,
    sort: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[Doctor]:
    results = _DOCTORS

    if specialization:
        wanted = _normalize_specialty(specialization).lower()
        results = [d for d in results if d.doctor_type.lower() == wanted]

    if city:
        wanted_city = city.strip().lower()
        results = [d for d in results if (d.city or "").lower() == wanted_city]

    if q:
        needle = q.strip().lower()
        results = [
            d for d in results
            if needle in d.doctor_name.lower()
            or needle in d.doctor_type.lower()
            or needle in (d.hospital or "").lower()
        ]

    if max_fees is not None:
        results = [d for d in results if d.fees <= max_fees]

    if min_exp is not None:
        results = [d for d in results if d.experience_years >= min_exp]

    results = _sort_doctors(results, sort)

    if limit is not None:
        results = results[:limit]

    return results


def get_doctor(doctor_id: str) -> Optional[Doctor]:
    return _BY_ID.get(doctor_id)


def list_specializations() -> list[str]:
    return sorted({d.doctor_type for d in _DOCTORS})


def list_cities() -> list[str]:
    """Distinct normalized city names — for a frontend filter dropdown."""
    return sorted({d.city for d in _DOCTORS if d.city})


def recommend_for_complaint(
    complaint: Optional[str], city: Optional[str] = None, limit: int = 10
) -> list[Doctor]:
    """complaint = CaseSheet.condition_key (e.g. "chest_pain") — specialty_map
    resolves it to a specialization, most-experienced-first. Falls back to all
    cities if the patient's city has nobody in that specialization, rather
    than returning an empty list."""
    specialization = specialty_for_complaint(complaint)
    doctors = list_doctors(specialization=specialization, city=city, sort="-experience_years", limit=limit)
    if not doctors and city:
        doctors = list_doctors(specialization=specialization, sort="-experience_years", limit=limit)
    return doctors
