"""Floating AI Bot's ONLY backend contract — deliberately separate from
/api/session/* (Symptom Check) and /api/patients/* (Reports/Appointments).
The bot never reads or writes case-taking state; it only classifies intent
and returns a reply + optional navigation action."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.user import User
from app.services import bot_intent

router = APIRouter(prefix="/api/bot", tags=["bot"])


class BotQuery(BaseModel):
    message: str
    lang: str = "en"


@router.post("/query")
def query(payload: BotQuery, current_user: User = Depends(get_current_user)):
    return bot_intent.handle_query(
        payload.message, current_user.role.value, current_user.id, lang=payload.lang
    )
