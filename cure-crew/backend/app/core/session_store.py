"""
Session store — Redis pe case sheet state rakhta hai.

Muskan: agar Redis abhi set nahi hua, ye apne aap in-memory fallback pe chala jaata hai,
taaki baaki team blocked na rahe. Redis aane pe REDIS_URL .env me daal do, kuch aur badalne
ki zaroorat nahi.
"""
import json
from typing import Optional
from app.core.config import settings
from app.models.case_sheet import CaseSheet

try:
    import redis
    _r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    _r.ping()
    _USE_REDIS = True
except Exception:
    _USE_REDIS = False
    _mem: dict[str, str] = {}


def _key(session_id: str) -> str:
    return f"session:{session_id}"


def save(sheet: CaseSheet) -> None:
    data = sheet.model_dump_json()
    if _USE_REDIS:
        _r.setex(_key(sheet.session_id), settings.SESSION_TTL_SECONDS, data)
    else:
        _mem[_key(sheet.session_id)] = data


def load(session_id: str) -> Optional[CaseSheet]:
    raw = _r.get(_key(session_id)) if _USE_REDIS else _mem.get(_key(session_id))
    if not raw:
        return None
    return CaseSheet.model_validate(json.loads(raw))


def backend_name() -> str:
    return "redis" if _USE_REDIS else "in-memory (fallback)"
