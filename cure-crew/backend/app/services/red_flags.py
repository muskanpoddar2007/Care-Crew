"""
Red-flag detection — RULE-BASED, LLM-based nahi.

Rules simple aur deterministic hain. Judges ko sabse pehle yehi dikhana hai — jaise hi
dangerous combination bane, urgent flag lag jaata hai. LLM pe ye kaam mat chhodo, wo miss
kar dega.

Dispatched by sheet.condition_key so each condition tree gets rules relevant to it,
plus a small set of generic rules that apply regardless of condition.
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


def _severity_num(sheet: CaseSheet) -> int:
    sev = sheet.hopi.severity.value or ""
    try:
        return int("".join(c for c in sev if c.isdigit()) or 0)
    except ValueError:
        return 0


# ---------------------------------------------------------------------------
# Chest pain — UNCHANGED from the original implementation.
# ---------------------------------------------------------------------------

def _chest_pain_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    radiation = (sheet.hopi.radiation.value or "").lower()
    radiates_arm = any(w in radiation for w in ("arm", "haath", "jabda", "jaw", "peeth", "back"))

    if radiates_arm and _has(sheet, "sweating"):
        flags.append("URGENT: Cardiac — chest pain radiating with sweating")

    if _has(sheet, "breathlessness"):
        flags.append("URGENT: Chest pain with breathlessness — cardiac/respiratory")

    if _severity_num(sheet) >= 8 and _has(sheet, "sweating"):
        flags.append("URGENT: Severe chest pain (>=8/10) with sweating")

    return flags


# ---------------------------------------------------------------------------
# New condition-specific rule sets.
# ---------------------------------------------------------------------------

def _fever_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []
    sev = _severity_num(sheet)

    if sev >= 8 and _has(sheet, "breathlessness"):
        flags.append("URGENT: High fever with breathlessness")
    if _has(sheet, "rash"):
        flags.append("URGENT: Fever with rash — needs prompt evaluation")
    if _has(sheet, "breathlessness"):
        flags.append("URGENT: Fever with breathing difficulty")

    return flags


def _stomach_pain_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    if _has(sheet, "blood_in_stool"):
        flags.append("URGENT: Blood in stool")
    if _has(sheet, "blood_in_vomit"):
        flags.append("URGENT: Blood in vomit")
    if _severity_num(sheet) >= 8:
        flags.append("URGENT: Severe abdominal pain (>=8/10)")

    return flags


def _headache_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    if _has(sheet, "worst_headache_ever"):
        flags.append("URGENT: Sudden, worst-ever headache")
    if _has(sheet, "vision_changes"):
        flags.append("URGENT: Headache with vision changes")
    if _has(sheet, "neck_stiffness"):
        flags.append("URGENT: Headache with neck stiffness/fever")

    return flags


def _body_pain_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    if _has(sheet, "weakness"):
        flags.append("URGENT: Body pain with significant weakness")

    return flags


def _cough_cold_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    if _has(sheet, "blood_in_cough"):
        flags.append("URGENT: Blood in cough")
    if _has(sheet, "breathlessness"):
        flags.append("URGENT: Cough with breathing difficulty")
    if _has(sheet, "chest_pain_with_cough"):
        flags.append("URGENT: Cough with chest pain")

    return flags


def _breathing_difficulty_rules(sheet: CaseSheet) -> list[str]:
    flags: list[str] = []

    if _has(sheet, "breathless_at_rest"):
        flags.append("URGENT: Breathless even at rest")
    if _has(sheet, "lips_bluish"):
        flags.append("URGENT: Bluish lips/fingers — possible low oxygen")
    if _has(sheet, "chest_pain_with_breathing"):
        flags.append("URGENT: Breathing difficulty with chest pain")

    return flags


_CONDITION_RULES = {
    "chest_pain": _chest_pain_rules,
    "fever": _fever_rules,
    "stomach_pain": _stomach_pain_rules,
    "headache": _headache_rules,
    "body_pain": _body_pain_rules,
    "cough_cold": _cough_cold_rules,
    "breathing_difficulty": _breathing_difficulty_rules,
}


def _generic_rules(sheet: CaseSheet) -> list[str]:
    """Applies regardless of condition — catches severe cases even on a
    dynamically-generated (no predefined tree) path."""
    flags: list[str] = []
    if _severity_num(sheet) >= 9:
        flags.append("URGENT: Very severe symptom (>=9/10)")
    if _has(sheet, "breathlessness") or _has(sheet, "breathless_at_rest"):
        flags.append("URGENT: Breathing difficulty reported")
    return flags


def evaluate(sheet: CaseSheet) -> list[str]:
    """Naye red flags return karta hai (jo abhi sheet me nahi hain)."""
    rule_fn = _CONDITION_RULES.get(sheet.condition_key or "")
    flags = rule_fn(sheet) if rule_fn else []
    flags = flags + _generic_rules(sheet)

    # de-dupe while preserving order, then drop anything already recorded
    seen = set()
    deduped = [f for f in flags if not (f in seen or seen.add(f))]
    return [f for f in deduped if f not in sheet.red_flags]
