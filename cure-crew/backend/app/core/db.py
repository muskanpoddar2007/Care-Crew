"""
Generic key-value store for the prescription module — reuses the exact same
Redis-with-in-memory-fallback pattern as core/session_store.py (see that file),
instead of introducing a new database. session_store.py itself is untouched;
this is a separate, namespaced store so User/Prescription records don't collide
with case-taking sessions.
"""
import json
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from app.core.config import settings

try:
    import redis
    _r = redis.from_url(settings.REDIS_URL, decode_responses=True)
    _r.ping()
    _USE_REDIS = True
except Exception:
    _USE_REDIS = False

_mem_stores: dict[str, dict[str, str]] = {}

T = TypeVar("T", bound=BaseModel)


class KeyValueStore:
    """Namespaced store for one Pydantic model type. No TTL — records live until
    explicitly deleted (unlike session_store's session-expiry use case)."""

    def __init__(self, prefix: str, model: Type[T]):
        self.prefix = prefix
        self.model = model
        _mem_stores.setdefault(prefix, {})

    def _key(self, record_id: str) -> str:
        return f"{self.prefix}:{record_id}"

    def save(self, record_id: str, obj: T) -> None:
        data = obj.model_dump_json()
        if _USE_REDIS:
            _r.set(self._key(record_id), data)
        else:
            _mem_stores[self.prefix][self._key(record_id)] = data

    def get(self, record_id: str) -> Optional[T]:
        raw = _r.get(self._key(record_id)) if _USE_REDIS else _mem_stores[self.prefix].get(self._key(record_id))
        if not raw:
            return None
        return self.model.model_validate(json.loads(raw))

    def delete(self, record_id: str) -> bool:
        if _USE_REDIS:
            return bool(_r.delete(self._key(record_id)))
        return _mem_stores[self.prefix].pop(self._key(record_id), None) is not None

    def all(self) -> list[T]:
        """Full scan — fine at hackathon scale, not meant for large datasets."""
        if _USE_REDIS:
            keys = _r.keys(f"{self.prefix}:*")
            raws = _r.mget(keys) if keys else []
        else:
            raws = list(_mem_stores[self.prefix].values())
        return [self.model.model_validate(json.loads(r)) for r in raws if r]


def backend_name() -> str:
    return "redis" if _USE_REDIS else "in-memory (fallback)"
