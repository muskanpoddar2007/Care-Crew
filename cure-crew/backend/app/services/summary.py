"""
Plain-language case summary — patient-friendly or doctor-friendly register.

Gemini when GEMINI_API_KEY is set, a deterministic template otherwise (same
fallback pattern as extraction.py/intent.py). Only ever restates what was
already recorded in the case sheet — never adds a diagnosis or treatment.
"""
from app.core.config import settings
from app.models.case_sheet import CaseSheet

_HOPI_LABELS = [
    ("onset", "Onset"), ("location", "Location"), ("character", "Character"),
    ("duration", "Duration"), ("radiation", "Radiates to"),
    ("aggravating", "Worsened by"), ("relieving", "Relieved by"),
    ("timing", "Pattern"), ("severity", "Severity"),
]


def _collect_facts(sheet: CaseSheet) -> list[str]:
    facts = []
    if sheet.chief_complaint.value:
        facts.append(f"Chief complaint: {sheet.chief_complaint.value}")

    for attr, label in _HOPI_LABELS:
        ev = getattr(sheet.hopi, attr)
        if ev.value:
            facts.append(f"{label}: {ev.value}")

    for key, val in sheet.review_of_systems.items():
        v = val.get("value") if isinstance(val, dict) else val
        if v:
            facts.append(f"{key.replace('_', ' ').title()}: {v}")

    if sheet.past_history:
        facts.append(f"Past history: {', '.join(sheet.past_history)}")
    if sheet.drug_history:
        facts.append(f"Current medication: {', '.join(sheet.drug_history)}")
    if sheet.family_history:
        facts.append(f"Family history: {', '.join(sheet.family_history)}")
    if sheet.red_flags:
        facts.append(f"Red flags noted: {', '.join(sheet.red_flags)}")

    return facts


def _stub_summary(sheet: CaseSheet, audience: str) -> str:
    facts = _collect_facts(sheet)
    if audience == "doctor":
        header = f"Case Summary — {sheet.condition_key or 'unspecified'} ({sheet.department or 'General Medicine'})"
        body = "\n".join(f"- {f}" for f in facts) or "- No fields recorded yet."
        return f"{header}\n{body}"

    lines = ["Here's a simple summary of what you told us:"]
    lines += [f"- {f}" for f in facts] or ["- Nothing recorded yet."]
    lines.append(
        "\nThis is only a summary of what you shared — a doctor will review it and decide next "
        "steps. It is not a diagnosis."
    )
    return "\n".join(lines)


_PATIENT_PROMPT = """Tum ek caring health assistant ho. Neeche diye gaye case sheet facts ko
patient ke liye simple, non-medical, warm bhasha mein summarize karo — bina jargon ke.
DIAGNOSIS ya dawai suggest MAT karo. Sirf jo unhone bataya wahi wapas simple shabdon mein
bolo, aur ant mein yaad dilao ki ek doctor isko review karenge.

Facts:
{facts}

Summary:"""

_DOCTOR_PROMPT = """Tum ek medical scribe ho. Neeche diye gaye case sheet facts se ek concise,
clinical-style summary banao — jaisa ek doctor apne notes mein likhta hai (bullet points,
shorthand). DIAGNOSIS ya treatment suggest MAT karo, sirf jo record hua hai wahi summarize karo.

Facts:
{facts}

Summary:"""


def generate_summary(sheet: CaseSheet, audience: str = "patient") -> str:
    audience = audience if audience in ("patient", "doctor") else "patient"

    if not settings.GEMINI_API_KEY:
        return _stub_summary(sheet, audience)

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-3.6-flash", generation_config={"temperature": 0.3})
        facts = "\n".join(_collect_facts(sheet)) or "No fields recorded yet."
        template = _DOCTOR_PROMPT if audience == "doctor" else _PATIENT_PROMPT
        resp = model.generate_content(template.format(facts=facts))
        text = (resp.text or "").strip()
        return text or _stub_summary(sheet, audience)
    except Exception as e:
        print(f"[summary] fallback to stub: {e}")
        return _stub_summary(sheet, audience)
