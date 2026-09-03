"""Prescription model — Pydantic schema + the store instance it's persisted through."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.core.db import KeyValueStore


class PrescriptionStatus(str, Enum):
    ongoing = "ongoing"
    past = "past"


class Medicine(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None


class Prescription(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    prescription_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    document_url: str
    document_type: str

    status: PrescriptionStatus = PrescriptionStatus.ongoing
    medicines: list[Medicine] = Field(default_factory=list)
    doctor_instructions: Optional[str] = None
    precautions: Optional[str] = None

    summary: Optional[str] = None
    summary_generated: bool = False
    translations: dict[str, str] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


prescription_store = KeyValueStore("prescription", Prescription)
