"""
Red-flag detection — RULE-BASED, LLM-based nahi.

Rules simple aur deterministic hain. Judges ko sabse pehle yehi dikhana hai — jaise hi
dangerous combination bane, urgent flag lag jaata hai. LLM pe ye kaam mat chhodo, wo miss
kar dega.
"""
from app.models.case_sheet import CaseSheet


def _has(sheet: CaseSheet, ros_key: str) -> bool:
    """Affirmative check — free-text jawab ('haan bahut pasina') me bhi 'yes' pakadta hai.
    Negation ('nahi') pehle check karo taaki 'nahi ho raha' galti se yes na ban jaye."""
    v = sheet.review_of_systems.get(ros_key, {})
    val = str((v.get("value") if isinstance(v, dict) else v) or "").strip().lower()
    if not val:
        return False
    if any(neg in val for neg in ("nahi", "nhi", "no ", "bilkul nahi")):
        return False
    return any(pos in val for pos in ("yes", "haan", "haa", "ha ", "true", "pasina", "ho raha"))


def evaluate(sheet: CaseSheet) -> list[str]:
    """Naye red flags return karta hai (jo abhi sheet me nahi hain)."""
    flags: list[str] = []

    radiation = (sheet.hopi.radiation.value or "").lower()
    radiates_arm = any(w in radiation for w in ("arm", "haath", "jabda", "jaw", "peeth", "back"))

    # Rule 1 — classic cardiac pattern
    if radiates_arm and _has(sheet, "sweating"):
        flags.append("URGENT: Cardiac — chest pain radiating with sweating")

    # Rule 2 — chest pain + breathlessness
    if _has(sheet, "breathlessness"):
        flags.append("URGENT: Chest pain with breathlessness — cardiac/respiratory")

    # Rule 3 — high severity + sweating
    sev = sheet.hopi.severity.value or ""
    try:
        sev_num = int("".join(c for c in sev if c.isdigit()) or 0)
    except ValueError:
        sev_num = 0
    if sev_num >= 8 and _has(sheet, "sweating"):
        flags.append("URGENT: Severe chest pain (>=8/10) with sweating")

    # Naye hi return karo
    return [f for f in flags if f not in sheet.red_flags]
