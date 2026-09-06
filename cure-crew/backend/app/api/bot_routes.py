"""Floating AI Bot's ONLY backend contract — deliberately separate from
/api/session/* (Symptom Check) and /api/patients/* (Reports/Appointments).
The bot never reads or writes case-taking state; it only classifies intent
and returns a reply + optional navigation action."""
from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.responses import AppError, ok
from app.models.user import User
from app.services import bot_intent, voice_service

router = APIRouter(prefix="/api/bot", tags=["bot"])


class BotQuery(BaseModel):
    message: str
    lang: str = "en"


@router.post("/query")
def query(payload: BotQuery, current_user: User = Depends(get_current_user)):
    return bot_intent.handle_query(
        payload.message, current_user.role.value, current_user.id, lang=payload.lang
    )


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Mic button -> Sarvam speech-to-text. Returns {transcript, language_code}
    in the same {success,message,data} envelope as the rest of the newer
    modules (unlike /query, which is a legacy flat {reply,action} the
    existing bot.js frontend already depends on — not changed here)."""
    audio_bytes = await audio.read()
    try:
        result = voice_service.transcribe(audio_bytes, audio.filename, audio.content_type)
    except voice_service.VoiceTranscriptionError as e:
        raise AppError(502, str(e))
    return ok(data=result)
