"""
REST API routes. Frontend inhi endpoints se baat karega.

Muskan: WebSocket version bhi add kar sakti ho (live typing ke liye), par ye REST endpoints
demo ke liye kaafi hain aur frontend inhe aaj hi mock/real dono tareeke se use kar sakti hai.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.services import conversation, summary as summary_service, doctor_directory
from app.core import session_store
from app.core.auth import get_current_user_optional
from app.core.responses import ok, AppError
from app.models.user import User

router = APIRouter(prefix="/api", tags=["case-taking"])


class StartReq(BaseModel):
    # Optional — when omitted, the assistant classifies the condition itself
    # from the patient's own first message. Still accepted for backward
    # compatibility with direct/legacy callers that already know the tree.
    complaint: Optional[str] = None


class TurnReq(BaseModel):
    session_id: str
    patient_text: str
    asked_slot: str


@router.post("/session/start")
def start(req: StartReq, current_user: Optional[User] = Depends(get_current_user_optional)):
    patient_id = current_user.id if current_user else None
    return conversation.start_session(req.complaint, patient_id=patient_id)


@router.post("/session/turn")
def turn(req: TurnReq, current_user: Optional[User] = Depends(get_current_user_optional)):
    patient_id = current_user.id if current_user else None
    try:
        return conversation.process_turn(
            req.session_id, req.patient_text, req.asked_slot, patient_id=patient_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/session/{session_id}/casesheet")
def get_casesheet(session_id: str):
    sheet = session_store.load(session_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return sheet.model_dump()


@router.get("/session/{session_id}/final")
def get_final_casesheet(session_id: str):
    try:
        return conversation.get_final_case_sheet(session_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/session/{session_id}/summary")
def get_session_summary(session_id: str, audience: str = "patient"):
    """Plain-language summary of the case sheet so far — works mid-conversation
    too, not just once complete. patient/doctor audience toggle."""
    sheet = session_store.load(session_id)
    if sheet is None:
        raise HTTPException(status_code=404, detail="Session not found")
    text = summary_service.generate_summary(sheet, audience)
    return {"summary": text, "audience": audience}


@router.get("/session/{session_id}/recommended-doctors")
def get_recommended_doctors(
    session_id: str,
    city: Optional[str] = Query(None, description="Filter to this city; omit for all cities"),
):
    """Chief-complaint-based doctor suggestions for this session — condition_key
    (set once intent detection runs) maps to a specialization via specialty_map,
    then app/services/doctor_directory picks the top 10, most-experienced-first.
    `city` is an optional query param (not read from CaseSheet/User — neither
    has a city field): pass it to scope results, omit it for all cities."""
    sheet = session_store.load(session_id)
    if sheet is None:
        raise AppError(404, "Session not found")
    doctors = doctor_directory.recommend_for_complaint(sheet.condition_key, city=city, limit=10)
    return ok(data=[d.model_dump() for d in doctors])
