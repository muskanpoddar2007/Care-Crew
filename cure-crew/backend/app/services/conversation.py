import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.models.case_sheet import CaseSheet, Evidence
from app.core import session_store
from app.services import question_tree, extraction, red_flags, intent, dynamic_questions
from app.services.reports_store import case_report_store

logger = logging.getLogger("cure_crew.orchestration")

_GENERIC_OPENER = (
    "Namaste. Main samajhna chahta hoon aap kaisa mehsoos kar rahe hain — jab tayyar ho, "
    "bataiye aapko kya taklif ho rahi hai. Main dhyan se sun raha hoon."
)

_ACK_POOL = [
    "Samajh gaya, ye sunke thoda takleef hui hogi.",
    "Theek hai, main samajh sakta hoon.",
    "Aapne sahi bataya, shukriya batane ke liye.",
    "Achha, ye jaanna zaroori tha.",
    "I understand, that sounds uncomfortable.",
    "Thank you for sharing that — that helps.",
]

_REPHRASE_PREFIXES = [
    "Maaf kijiye, mujhe thoda samajh nahi aaya — ",
    "Sorry, ek baar phir se poochta hoon — ",
    "Koi baat nahi, thoda alag tarike se poochta hoon — ",
]

# Pure filler/non-answers only — NOT "haan"/"nahi", which are legitimate
# yes/no answers to review-of-systems screening questions.
_FILLERS = {"ok", "okay", "k", "hmm", "hm", "..", "...", "?", "acha", "achha"}

_MAX_MISSES = 2


def _get_flag_id(flag: Any) -> Any:
    """Safely extracts a unique identifier from a red flag object, dict, or string."""
    if hasattr(flag, "id"):
        return flag.id
    if isinstance(flag, dict) and "id" in flag:
        return flag["id"]
    return flag


def _is_low_signal(text: str) -> bool:
    """Filler/non-answers we can catch deterministically without an LLM call —
    e.g. 'hmm', '?'. Deliberately does NOT flag short-but-meaningful answers
    like a single digit ('7' for severity) or 'ha'/'na'. Real semantic-mismatch
    detection (patient answers a well-formed but unrelated sentence) is
    extraction.py's job via Gemini."""
    t = (text or "").strip().lower()
    if not t:
        return True
    return t in _FILLERS


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
                attr.append(value)
            else:
                setattr(sheet, parts[0], ev)

        elif len(parts) == 2:
            parent, child = parts
            obj = getattr(sheet, parent)

            if isinstance(obj, dict):
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


def _remaining_slots(sheet: CaseSheet) -> list:
    """Every not-yet-filled slot for this session's tree — passed to
    extraction.extract() as candidates so a single rich answer (e.g. duration
    + radiation + sweating together) can fill more than just the asked slot."""
    if sheet.condition_key is None:
        return []
    if sheet.tree_source == "predefined":
        tree = question_tree.load_tree(sheet.condition_key)
        return question_tree.remaining_slots(sheet, tree)
    return dynamic_questions.remaining_dynamic_slots(sheet)


def _apply_patches(sheet: CaseSheet, patches: dict, turn_index: int, primary_slot: str) -> bool:
    """Writes every slot extraction.extract() returned into the sheet (bonus
    slots included, not just primary_slot). Returns whether primary_slot
    itself got a value — that's what retry/miss tracking cares about; a bonus
    slot filling in doesn't excuse the actually-asked slot from being empty."""
    primary_success = False
    for slot, patch in patches.items():
        wrote = _set_slot(sheet, slot, patch, turn_index)
        if slot == primary_slot:
            primary_success = wrote
    return primary_success


def _force_not_recorded(sheet: CaseSheet, slot: str, turn_index: int) -> None:
    """After two misses on the same slot, stop looping — record it as skipped
    and let the flow move on."""
    _set_slot(sheet, slot, {"value": "Not recorded", "evidence": None}, turn_index)
    sheet.retry_counts.pop(slot, None)


def _next_question(sheet: CaseSheet) -> Optional[dict]:
    """Single source of truth for 'what should be asked next' — used both to
    advance the flow AND to re-fetch the currently-pending question (since the
    still-unfilled asked_slot is always the earliest unfilled slot in order)."""
    if sheet.condition_key is None:
        return {"slot": "chief_complaint", "question": _GENERIC_OPENER}
    if sheet.tree_source == "predefined":
        tree = question_tree.load_tree(sheet.condition_key)
        return question_tree.next_question(sheet, tree)
    return dynamic_questions.next_dynamic_question(sheet)


def _apply_red_flags(sheet: CaseSheet) -> list:
    new_flags = red_flags.evaluate(sheet)
    existing_ids = {_get_flag_id(f) for f in sheet.red_flags}
    fresh = [f for f in new_flags if _get_flag_id(f) not in existing_ids]
    if fresh:
        sheet.red_flags.extend(fresh)
        sheet.is_urgent = True
        logger.warning(f"session={sheet.session_id} new_red_flags={fresh}")
    return fresh


def _maybe_persist_report(sheet: CaseSheet) -> None:
    """Once a session completes for a logged-in patient, keep a permanent copy
    so it survives the live session's TTL and shows up under their Reports tab."""
    if sheet.is_complete and sheet.patient_id:
        sheet.completed_at = datetime.now(timezone.utc)
        case_report_store.save(sheet.session_id, sheet)


def _acknowledge(sheet: CaseSheet) -> str:
    return _ACK_POOL[sheet.turn_count % len(_ACK_POOL)]


def _rephrase(sheet: CaseSheet, question_text: str) -> str:
    prefix = _REPHRASE_PREFIXES[sheet.turn_count % len(_REPHRASE_PREFIXES)]
    return f"{prefix}{question_text}"


def _clarify_prompt() -> str:
    return (
        "Main aapki poori tarah madad karna chahta hoon — kya aap thoda aur bata sakte hain? "
        "Jaise, koi taklif/symptom ho raha hai, ya aap appointment book karna ya reports dekhna chahte hain?"
    )


def _completion_message() -> str:
    return "Shukriya — maine sab kuch note kar liya hai. Ab doctor aapka case sheet review karenge."


def _response(
    sheet: CaseSheet,
    next_question: Optional[str],
    next_slot: Optional[str],
    extraction_succeeded: bool,
    new_flags: list,
    action: Optional[dict],
) -> Dict[str, Any]:
    return {
        "session_id": sheet.session_id,
        "next_question": next_question,
        "next_slot": next_slot,
        "extraction_succeeded": extraction_succeeded,
        "is_urgent": sheet.is_urgent,
        "new_red_flags": new_flags,
        "is_complete": sheet.is_complete,
        "state": sheet.model_dump(),
        "action": action,
        "condition_key": sheet.condition_key,
        "department": sheet.department,
    }


def start_session(complaint: str = None, patient_id: str = None) -> Dict[str, Any]:
    """Initializes a new diagnostic session.

    complaint=None (default, used by the chat UI) -> generic warm opener; the
    condition is picked from the patient's own first message via intent
    detection.
    complaint="chest_pain" etc. (legacy — used by run_extraction_test.py) ->
    skips intent detection and goes straight into that tree, exactly like
    before.
    """
    session_id = str(uuid.uuid4())[:8]
    sheet = CaseSheet(session_id=session_id, turn_count=0, patient_id=patient_id)

    if complaint:
        sheet.condition_key = complaint
        sheet.department = intent.CONDITIONS.get(complaint, {}).get("department")
        sheet.tree_source = "predefined" if question_tree.has_tree(complaint) else "dynamic"

    session_store.save(sheet)

    return {
        "session_id": session_id,
        "next_question": _GENERIC_OPENER if not complaint else question_tree.load_tree(complaint).get("opening_question"),
        "next_slot": "chief_complaint",
        "is_urgent": False,
        "is_complete": False,
        "action": None,
        "condition_key": sheet.condition_key,
        "department": sheet.department,
    }


def process_turn(
    session_id: str,
    patient_text: str,
    asked_slot: str,
    complaint: str = None,   # unused — kept for backward-compatible call signatures
    patient_id: str = None,
) -> Dict[str, Any]:
    """Processes a single conversational turn."""
    sheet = session_store.load(session_id)
    if sheet is None:
        raise ValueError(f"Session {session_id} expired or not found")

    sheet.turn_count += 1
    turn_index = sheet.turn_count

    if patient_id and not sheet.patient_id:
        sheet.patient_id = patient_id

    # 1. Action intent — checked on every turn, before anything else. Never
    #    corrupts slot-filling state: the pending question is simply re-shown.
    action = intent.detect_action(patient_text)
    if action:
        session_store.save(sheet)
        pending = _next_question(sheet)
        ack = f"Bilkul, main aapki madad karta hoon — neeche '{action['label']}' button dabaiye."
        if pending:
            ack += f" Jab ready ho, hum yahin se continue karenge: {pending['question']}"
        return _response(
            sheet,
            next_question=ack,
            next_slot=(pending["slot"] if pending else asked_slot),
            extraction_succeeded=False,
            new_flags=[],
            action=action,
        )

    # 2. First message — chief_complaint not yet captured. Classify condition
    #    (unless start_session already pinned one, in the legacy call path).
    if sheet.chief_complaint.value in (None, ""):
        if sheet.condition_key is None:
            intent_type = intent.classify_intent(patient_text)
            if intent_type == "unclear":
                session_store.save(sheet)
                return _response(
                    sheet,
                    next_question=_clarify_prompt(),
                    next_slot="chief_complaint",
                    extraction_succeeded=False,
                    new_flags=[],
                    action=None,
                )
            classification = intent.classify_condition(patient_text)
            sheet.condition_key = classification["condition_key"]
            sheet.department = classification["department"]
            sheet.tree_source = "predefined" if classification["has_tree"] else "dynamic"

        candidate_slots = _remaining_slots(sheet)
        patches = extraction.extract("chief_complaint", patient_text, candidate_slots=candidate_slots)
        _apply_patches(sheet, patches, turn_index, primary_slot="chief_complaint")

        new_flags = _apply_red_flags(sheet)
        nxt = _next_question(sheet)
        sheet.is_complete = nxt is None
        _maybe_persist_report(sheet)
        session_store.save(sheet)

        next_q = f"{_acknowledge(sheet)} {nxt['question']}" if nxt else _completion_message()
        return _response(
            sheet,
            next_question=next_q,
            next_slot=(nxt["slot"] if nxt else None),
            extraction_succeeded=True,
            new_flags=new_flags,
            action=None,
        )

    # 3. Mid-tree — this message answers `asked_slot`, but may volunteer other
    #    still-unfilled slots too (e.g. duration + radiation + sweating in one
    #    breath) — extraction.extract() fills whatever it finds in one call.
    if _is_low_signal(patient_text):
        patches = {}
    else:
        candidate_slots = _remaining_slots(sheet)
        patches = extraction.extract(asked_slot, patient_text, candidate_slots=candidate_slots)
    success = _apply_patches(sheet, patches, turn_index, primary_slot=asked_slot)

    if success:
        sheet.retry_counts.pop(asked_slot, None)
    else:
        miss_count = sheet.retry_counts.get(asked_slot, 0) + 1
        sheet.retry_counts[asked_slot] = miss_count

        if miss_count < _MAX_MISSES:
            new_flags = _apply_red_flags(sheet)
            pending = _next_question(sheet)  # same slot again — still unfilled
            session_store.save(sheet)
            return _response(
                sheet,
                next_question=_rephrase(sheet, pending["question"]) if pending else _completion_message(),
                next_slot=(pending["slot"] if pending else None),
                extraction_succeeded=False,
                new_flags=new_flags,
                action=None,
            )

        # Two misses — stop looping, record as skipped, and move on.
        _force_not_recorded(sheet, asked_slot, turn_index)
        success = True

    new_flags = _apply_red_flags(sheet)
    nxt = _next_question(sheet)
    sheet.is_complete = nxt is None
    _maybe_persist_report(sheet)
    session_store.save(sheet)

    next_q = f"{_acknowledge(sheet)} {nxt['question']}" if nxt else _completion_message()
    return _response(
        sheet,
        next_question=next_q,
        next_slot=(nxt["slot"] if nxt else None),
        extraction_succeeded=success,
        new_flags=new_flags,
        action=None,
    )


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
