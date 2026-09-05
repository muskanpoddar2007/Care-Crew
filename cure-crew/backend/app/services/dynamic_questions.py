"""
Dynamic question fallback — for a condition with NO predefined tree in app/data/.

Same determinism rule as question_tree.py: CODE decides which slot comes next,
in a fixed universal order. Gemini's only job here is to PHRASE that slot's
question gently, in context of what the patient already said — never to pick
the next topic. Falls back to a plain templated question when no
GEMINI_API_KEY is set, so this always works offline.
"""
from app.core.config import settings
from app.models.case_sheet import CaseSheet
from app.services.question_tree import slot_filled as _slot_filled

# Universal checklist, same order every predefined tree follows:
# mandatory HOPI -> red-flag screening -> background history.
_UNIVERSAL_SLOTS = [
    ("hopi.onset", "Ye taklif kab se shuru hui? Achanak hui ya dheere-dheere badhi?"),
    ("hopi.location", "Ye taklif shareer mein kahan mehsoos hoti hai?"),
    ("hopi.character", "Ye kaisa mehsoos hota hai — bataiye apne shabdon mein."),
    ("hopi.duration", "Ek baar shuru hone par kitni der rehta hai?"),
    ("hopi.severity", "1 se 10 ke beech, ye kitna tez hai? 10 sabse zyada."),
    ("hopi.aggravating", "Kis cheez se ye badhta hai?"),
    ("hopi.relieving", "Kis se aaram milta hai?"),
    ("review_of_systems.fever_with_it", "Iske saath bukhaar bhi hai?", True),
    ("review_of_systems.breathlessness", "Saans lene mein takleef hoti hai?", True),
    ("past_history", "Pehle kabhi koi bimari (BP, sugar, heart) rahi hai?"),
    ("drug_history", "Abhi koi dawai chal rahi hai?"),
]

_PHRASE_PROMPT = """Tum ek gentle, caring health worker ho jo patient ki history le rahe ho.
Tumhara kaam sirf EK sawaal ko naturally, warmly phrase karna hai — diagnosis ya salah nahi deni.

Patient ki taklif: {complaint}
Ab jo poochna hai (matlab): {hint}

Ek chhota, gentle, bilingual (Hindi/Hinglish + English mix jaisa patient bol raha hai) sawaal
likho. Sirf sawaal do, koi extra text nahi.

Sawaal:"""


def _stub_question(hint: str) -> str:
    return hint


def _phrase_question(hint: str, complaint: str) -> str:
    if not settings.GEMINI_API_KEY:
        return _stub_question(hint)
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-3.6-flash", generation_config={"temperature": 0.4})
        prompt = _PHRASE_PROMPT.format(complaint=complaint or "taklif", hint=hint)
        resp = model.generate_content(prompt)
        text = (resp.text or "").strip()
        return text or _stub_question(hint)
    except Exception as e:
        print(f"[dynamic_questions] fallback to stub: {e}")
        return _stub_question(hint)


def next_dynamic_question(sheet: CaseSheet) -> dict | None:
    """Same contract as question_tree.next_question: {slot, question} or None."""
    complaint = sheet.chief_complaint.value or ""
    for entry in _UNIVERSAL_SLOTS:
        slot, hint = entry[0], entry[1]
        if not _slot_filled(sheet, slot):
            return {"slot": slot, "question": _phrase_question(hint, complaint)}
    return None


def remaining_dynamic_slots(sheet: CaseSheet) -> list[str]:
    """Same contract as question_tree.remaining_slots — every not-yet-filled
    slot in the universal checklist, for multi-slot extraction candidates."""
    return [entry[0] for entry in _UNIVERSAL_SLOTS if not _slot_filled(sheet, entry[0])]
