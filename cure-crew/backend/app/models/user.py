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
    email: EmailStr
    phone: Optional[str] = None
    hashed_password: str
    role: UserRole = UserRole.patient
    department: Optional[str] = None    # doctor only
    specialty: Optional[str] = None     # doctor only
    photo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserPublic(BaseModel):
    """Safe-to-return shape — no password field exists here, so it can never leak."""
    id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole
    department: Optional[str] = None
    specialty: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserRegister(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str = Field(min_length=6)
    role: UserRole = UserRole.patient
    department: Optional[str] = None
    specialty: Optional[str] = None
    photo_url: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


user_store = KeyValueStore("user", User)


def get_user_by_email(email: str) -> Optional[User]:
    """Full scan — fine at hackathon scale; there's no secondary email index."""
    email = email.lower()
    for user in user_store.all():
        if user.email.lower() == email:
            return user
    return None
