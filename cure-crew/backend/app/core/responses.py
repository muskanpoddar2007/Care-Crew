"""
Consistent {success, message, data|error} response envelope for the prescription
module's API. The existing chest_pain routes (app/api/routes.py) don't use one —
this is scoped to the new auth/prescription routes only, per the spec.
"""
from typing import Any, Optional

from fastapi import HTTPException


def ok(data: Any = None, message: str = "Success") -> dict:
    return {"success": True, "message": message, "data": data}


class AppError(HTTPException):
    """Raise this in the prescription module for a top-level {success:false,...}
    error body, instead of FastAPI's default {"detail": ...} shape."""

    def __init__(self, status_code: int, message: str, error: Optional[str] = None):
        super().__init__(
            status_code=status_code,
            detail={"success": False, "message": message, "error": error or message},
        )
