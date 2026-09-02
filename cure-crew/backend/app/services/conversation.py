import logging
import uuid
from typing import Dict, Any

from app.models.case_sheet import CaseSheet, Evidence
from app.core import session_store
from app.services import question_tree, extraction, red_flags

logger = logging.getLogger("cure_crew.orchestration")


def _get_flag_id(flag: Any) -> Any:
    """Safely extracts a unique identifier from a red flag object, dict, or string."""
    if hasattr(flag, "id"):
        return flag.id
    if isinstance(flag, dict) and "id" in flag:
        return flag["id"]
    return flag


def _set_slot(sheet: CaseSheet, slot: str, patch: dict, turn_index: int) -> bool:
    """
    Sets extracted value + evidence into the dotted slot path.
    Returns True if data was written, False if extraction was empty or path was invalid.
    """
    value = patch.get("value")
    if value in (None, "", []):
        logger.info(f"No usable extraction for slot={slot} turn={turn_index}")
        return False

    parts = slot.split(".")
    ev = Evidence(value=value, evidence=patch.get("evidence"), turn_index=turn_index)

    try:
        if len(parts) == 1:
            attr = getattr(sheet, parts[0])
            if isinstance(attr, list):
                # These list fields (past_history, drug_history, ...) are typed list[str]
                attr.append(value)
            else:
                setattr(sheet, parts[0], ev)
                
        elif len(parts) == 2:
            parent, child = parts
            obj = getattr(sheet, parent)
            
            if isinstance(obj, dict):
                # Dictionaries require serialized data, not Pydantic objects
                obj[child] = ev.model_dump()
            else:
                setattr(obj, child, ev)
        else:
            logger.warning(f"Unsupported nested slot depth: {slot}")
            return False
            
    except AttributeError:
        logger.warning(f"Unknown slot or invalid schema path: {slot}")
        return False

    return True


def start_session(complaint: str) -> Dict[str, Any]:
    """Initializes a new diagnostic session and saves the chief complaint."""
    session_id = str(uuid.uuid4())[:8]
    
    # Store the complaint IN the sheet so the frontend doesn't have to remember it
    sheet = CaseSheet(
        session_id=session_id,
        chief_complaint=Evidence(value=complaint),
        turn_count=0
    )
    
    tree = question_tree.load_tree(complaint)
    session_store.save(sheet)
    
    return {
        "session_id": session_id,
        "next_question": tree.get("opening_question"),
        "next_slot": "chief_complaint",
        "is_urgent": False,
        "is_complete": False,
    }


def process_turn(session_id: str, patient_text: str, asked_slot: str, complaint: str = "chest_pain") -> Dict[str, Any]:
    """Processes a single conversational turn."""
    sheet = session_store.load(session_id)
    if sheet is None:
        raise ValueError(f"Session {session_id} expired or not found")

    # 1. Load tree using the complaint type passed by the caller (sheet.chief_complaint
    # holds the patient's actual answer text, not the tree key, once that slot is answered)
    tree = question_tree.load_tree(complaint)

    # 2. Increment turn counter
    sheet.turn_count += 1
    
    # 3. Extract & Merge
    patch = extraction.extract(asked_slot, patient_text)
    extraction_succeeded = _set_slot(sheet, asked_slot, patch, sheet.turn_count)

    # 4. Evaluate & Deduplicate Red Flags
    new_flags = red_flags.evaluate(sheet)
    
    existing_flag_ids = {_get_flag_id(f) for f in sheet.red_flags}
    fresh_flags = [f for f in new_flags if _get_flag_id(f) not in existing_flag_ids]
    
    if fresh_flags:
        sheet.red_flags.extend(fresh_flags)
        sheet.is_urgent = True
        logger.warning(f"session={session_id} new_red_flags={fresh_flags}")

    # 5. Determine Next Question
    nxt = question_tree.next_question(sheet, tree)
    sheet.is_complete = nxt is None
    
    session_store.save(sheet)

    return {
        "session_id": session_id,
        "next_question": nxt["question"] if nxt else None,
        "next_slot": nxt["slot"] if nxt else None,
        "extraction_succeeded": extraction_succeeded,
        "is_urgent": sheet.is_urgent,
        "new_red_flags": fresh_flags,
        "is_complete": sheet.is_complete,
        "state": sheet.model_dump(),
    }


def _flatten(node: Any) -> Any:
    """Strips Evidence wrappers ({value, evidence, turn_index}) down to plain values."""
    if isinstance(node, dict):
        if node.keys() >= {"value", "evidence", "turn_index"}:
            return node.get("value")
        return {k: _flatten(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_flatten(v) for v in node]
    return node


def get_final_case_sheet(session_id: str) -> Dict[str, Any]:
    """
    Returns the completed case sheet as clean JSON (Evidence wrappers flattened to
    plain values) once history-taking is done.
    """
    sheet = session_store.load(session_id)
    if sheet is None:
        raise ValueError(f"Session {session_id} expired or not found")
    if not sheet.is_complete:
        raise RuntimeError(f"Session {session_id} is not complete yet")

    return _flatten(sheet.model_dump())