"""Appointment model — same shape/pattern as models/user.py (Pydantic +
KeyValueStore). A minimal real booking-request record, not a placeholder."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.core.db import KeyValueStore


class AppointmentStatus(str, Enum):
    requested = "requested"
    confirmed = "confirmed"
    cancelled = "cancelled"


class Appointment(BaseModel):
    id: str
    patient_id: str
    patient_name: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    department: str
    preferred_date: Optional[str] = None
    note: Optional[str] = None
    urgent: bool = False
    type: str = "standard"  # "standard" | "sos"
    is_sos: bool = False
    case_sheet_id: Optional[str] = None
    status: AppointmentStatus = AppointmentStatus.requested
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentCreate(BaseModel):
    department: str
    preferred_date: Optional[str] = None
    note: Optional[str] = None
    urgent: bool = False
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    case_sheet_id: Optional[str] = None
    type: str = "standard"
    is_sos: bool = False


appointment_store = KeyValueStore("appointment", Appointment)
