"""
Question selection — DETERMINISTIC. LLM ko agla sawaal chunne NAHI dena.

Ye pura demo ki jaan hai: LLM sirf question ko natural bolta hai aur jawab se data nikaalta
hai. Agla kaunsa sawaal poochna hai — wo yahan decide hota hai, code se. Isse repeat/skip/
hallucination nahi hoti.
"""
import json
from pathlib import Path
from app.models.case_sheet import CaseSheet

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def load_tree(complaint: str = "chest_pain") -> dict:
    with open(_DATA_DIR / f"{complaint}.json", encoding="utf-8") as f:
        return json.load(f)


def _slot_filled(sheet: CaseSheet, slot: str) -> bool:
    """Dotted path (e.g. 'hopi.onset') dekh ke check karo bhara hai ya nahi."""
    obj = sheet.model_dump()
    for part in slot.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return False
        obj = obj[part]
    if isinstance(obj, dict):          # Evidence object
        return obj.get("value") not in (None, "")
    if isinstance(obj, list):
        return len(obj) > 0
    return obj not in (None, "")


def next_question(sheet: CaseSheet, tree: dict) -> dict | None:
    """
    Priority order: mandatory HOPI -> screening (red-flag) -> background.
    Return {slot, question} ya None (matlab sab ho gaya).
    """
    for group in ("mandatory_slots", "screening_questions", "background_slots"):
        for item in tree.get(group, []):
            if not _slot_filled(sheet, item["slot"]):
                return item
    return None


def is_complete(sheet: CaseSheet, tree: dict) -> bool:
    return next_question(sheet, tree) is None
