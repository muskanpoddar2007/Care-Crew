"""Doctor directory record.

Read-only reference data sourced from app/data/doctors.csv (see
app/services/doctor_directory.py for the loader) — unlike User/Appointment
this is NOT KeyValueStore-backed, the app never writes to it, so there's no
"new DB" here, just a Pydantic shape for what the CSV loader hands back.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Doctor(BaseModel):
    id: str
    doctor_name: str
    doctor_type: str                    # normalized specialization, e.g. "Cardiologist"
    experience_years: int = 0
    fees: int = 0                       # normalized to a plain rupee integer (0 = free/unknown)
    hospital: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
