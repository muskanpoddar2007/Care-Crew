"""
Password hashing + JWT issuing/verification for the prescription module.
passlib[bcrypt] for hashing, python-jose for JWT — settings come from
core/config.py (JWT_SECRET_KEY etc.), same pattern as every other secret.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.responses import AppError
from app.models.user import User, user_store

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _pwd_context.verify(password, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """Returns the user_id (sub claim). Raises JWTError on a bad/expired token."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    return payload["sub"]


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)) -> User:
    """FastAPI dependency — verifies the bearer JWT and loads the current user.
    Use as `current_user: User = Depends(get_current_user)` to protect a route."""
    unauthorized = AppError(status.HTTP_401_UNAUTHORIZED, "Not authenticated", "missing or invalid token")

    if creds is None:
        raise unauthorized
    try:
        user_id = decode_access_token(creds.credentials)
    except JWTError:
        raise unauthorized

    user = user_store.get(user_id)
    if user is None:
        raise unauthorized
    return user
