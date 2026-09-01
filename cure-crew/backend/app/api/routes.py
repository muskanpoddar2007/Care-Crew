"""
REST API routes. Frontend inhi endpoints se baat karega.

Muskan: WebSocket version bhi add kar sakti ho (live typing ke liye), par ye REST endpoints
demo ke liye kaafi hain aur frontend inhe aaj hi mock/real dono tareeke se use kar sakti hai.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services import conversation
from app.core import session_store

router = APIRouter(prefix="/api", tags=["case-taking"])


class StartReq(BaseModel):
    complaint: str = "chest_pain"


class TurnReq(BaseModel):
    session_id: str
    patient_text: str
    asked_slot: str
    complaint: str = "chest_pain"


@router.post("/session/start")
def start(req: StartReq):
    return conversation.start_session(req.complaint)


@router.post("/session/turn")
def turn(req: TurnReq):
    try:
        return conversation.process_turn(
            req.session_id, req.patient_text, req.asked_slot, req.complaint
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/session/{session_id}/casesheet")
def get_casesheet(session_id: str):
    sheet = session_store.load(session_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return sheet.model_dump()
