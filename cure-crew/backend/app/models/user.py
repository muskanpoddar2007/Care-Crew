"""User model — Pydantic schema + the store instance it's persisted through."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.core.db import KeyValueStore


class UserRole(str, Enum):
    patient = "patient"
    doctor = "doctor"


class User(BaseModel):
    """Full user record, INCLUDING the hashed password. Never return this directly
    to a client — use UserPublic, which has no password field at all."""
    id: str
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    hashed_password: str
    role: UserRole = UserRole.patient
    department: Optional[str] = None    # doctor only
    specialty: Optional[str] = None     # doctor only
    abha_id: Optional[str] = None       # patient login identifier
    doctor_id: Optional[str] = None     # doctor login identifier
    photo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublic(BaseModel):
    """Safe-to-return shape — no password field exists here, so it can never leak."""
    id: str
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: UserRole
    department: Optional[str] = None
    specialty: Optional[str] = None
    abha_id: Optional[str] = None
    doctor_id: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserRegister(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(min_length=6)
    role: UserRole = UserRole.patient
    department: Optional[str] = None
    specialty: Optional[str] = None
    abha_id: Optional[str] = None       # required for role=patient (checked in the route)
    doctor_id: Optional[str] = None     # required for role=doctor (checked in the route)
    photo_url: Optional[str] = None


class UserLogin(BaseModel):
    """identifier = ABHA ID (patient), Doctor ID (doctor), or a legacy email —
    checked against all three in get_user_by_identifier() so accounts created
    before this field existed keep working."""
    identifier: str
    password: str


user_store = KeyValueStore("user", User)


def get_user_by_email(email: Optional[str]) -> Optional[User]:
    """Full scan — fine at hackathon scale; there's no secondary email index."""
    if not email:
        return None
    email = email.lower()
    for user in user_store.all():
        if user.email and user.email.lower() == email:
            return user
    return None


def get_user_by_identifier(identifier: Optional[str]) -> Optional[User]:
    """Matches abha_id, doctor_id, or (legacy) email — whichever the user has set."""
    if not identifier:
        return None
    ident = identifier.strip().lower()
    if not ident:
        return None
    for user in user_store.all():
        if user.abha_id and user.abha_id.strip().lower() == ident:
            return user
        if user.doctor_id and user.doctor_id.strip().lower() == ident:
            return user
        if user.email and user.email.lower() == ident:
            return user
    return None
