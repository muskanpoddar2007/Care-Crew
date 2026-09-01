"""
Conversation orchestration — sab pieces yahan jud'te hain.

Ye wo function hai jo frontend ko chahiye:
    process_turn(session_id, patient_text) -> {next_question, state, is_urgent, ...}

Flow:
  1. Session load karo (ya naya banao)
  2. Pichhle sawaal ka jawab extract karke state me merge karo
  3. Red flags check karo
  4. Agla sawaal chuno (deterministic)
  5. State save karke response return karo
"""
import uuid
from app.models.case_sheet import CaseSheet, Evidence
from app.core import session_store
from app.services import question_tree, extraction, red_flags


def _set_slot(sheet: CaseSheet, slot: str, patch: dict, turn_index: int) -> None:
    """Dotted slot path pe value + evidence set karo. Lists me append."""
    parts = slot.split(".")
    ev = Evidence(value=patch.get("value"), evidence=patch.get("evidence"), turn_index=turn_index)

    if len(parts) == 1:
        attr = getattr(sheet, parts[0])
        if isinstance(attr, list):
            if patch.get("value"):
                attr.append(patch["value"])
        else:
            setattr(sheet, parts[0], ev)
    elif len(parts) == 2:
        parent, child = parts
        obj = getattr(sheet, parent)
        if isinstance(obj, dict):               # review_of_systems
            obj[child] = ev.model_dump()
        else:                                    # hopi / personal_history
            setattr(obj, child, ev)


def start_session(complaint: str = "chest_pain") -> dict:
    session_id = str(uuid.uuid4())[:8]
    sheet = CaseSheet(session_id=session_id)
    tree = question_tree.load_tree(complaint)
    session_store.save(sheet)
    return {
        "session_id": session_id,
        "next_question": tree["opening_question"],
        "next_slot": "chief_complaint",
        "is_urgent": False,
        "is_complete": False,
    }


def process_turn(session_id: str, patient_text: str, asked_slot: str,
                 complaint: str = "chest_pain") -> dict:
    sheet = session_store.load(session_id)
    if sheet is None:
        raise ValueError(f"Session {session_id} not found")

    tree = question_tree.load_tree(complaint)

    # 1. pichhle sawaal ka jawab extract + merge
    turn_index = len(sheet.review_of_systems) + 1
    patch = extraction.extract(asked_slot, patient_text)
    _set_slot(sheet, asked_slot, patch, turn_index)

    # 2. red flags
    new_flags = red_flags.evaluate(sheet)
    if new_flags:
        sheet.red_flags.extend(new_flags)
        sheet.is_urgent = True

    # 3. agla sawaal
    nxt = question_tree.next_question(sheet, tree)
    sheet.is_complete = nxt is None
    session_store.save(sheet)

    return {
        "session_id": session_id,
        "next_question": nxt["question"] if nxt else None,
        "next_slot": nxt["slot"] if nxt else None,
        "is_urgent": sheet.is_urgent,
        "new_red_flags": new_flags,
        "is_complete": sheet.is_complete,
        "state": sheet.model_dump(),
    }
