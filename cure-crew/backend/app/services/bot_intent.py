"""
Floating-bot query intent — a SEPARATE intent space from services/intent.py.

services/intent.py classifies a SYMPTOM message into a condition category
(fever/stomach_pain/...) to drive the Symptom Check question tree. This
module answers a completely different question: "what does the user want the
APP to do" for the floating assistant widget — navigate somewhere, get a
last-visit summary, or get a gentle general answer. It never touches
case-taking state and is never used by the Symptom Check flow.

Rule-based keyword matching for navigation (deterministic — same philosophy
as the rest of the codebase), Gemini for the general-Q&A fallback when a key
is set, a plain templated fallback otherwise.
"""
from app.core.config import settings

# ---------------------------------------------------------------------------
# Patient query patterns
# ---------------------------------------------------------------------------

_PATIENT_PATTERNS = [
    {
        "target": "reports",
        "label": "View Reports",
        "reply": "Sure — here are your reports.",
        "keywords": [
            "show my report", "show reports", "has my report", "report aaya",
            "mera report", "reports dikhao", "report dikhao", "my reports",
        ],
    },
    {
        "target": "appointments",
        "label": "Book Appointment",
        "reply": "Sure, let's get an appointment booked for you.",
        "keywords": [
            "book appointment", "book an appointment", "appointment book",
            "doctor se milna", "appointment chahiye", "milna hai doctor",
        ],
    },
]

_PATIENT_LAST_VISIT_KEYWORDS = [
    "last visit", "pichli visit", "last appointment", "purani visit", "previous visit",
]

# ---------------------------------------------------------------------------
# Doctor query patterns
# ---------------------------------------------------------------------------

_DOCTOR_PATTERNS = [
    {
        "target": "doctor_appointments",
        "label": "View Appointments",
        "reply": "Here are today's appointments.",
        "keywords": [
            "today's appointments", "todays appointments", "aaj ki appointment",
            "appointment list", "today appointment",
        ],
    },
]

_DOCTOR_SUMMARY_KEYWORDS = [
    "generate a summary", "generate summary", "patient summary",
    "summarize this patient", "case summary", "summary of this patient",
]
_DOCTOR_PATIENT_DETAILS_KEYWORDS = ["patient details", "patient info", "patient ki details", "patient ke baare"]

_NO_PATIENT_CONTEXT_REPLY = (
    "I don't have a specific patient selected right now, so I can't pull up their case summary yet — "
    "patient lookup for doctors is coming in a later update."
)

# ---------------------------------------------------------------------------
# General Q&A — gentle, never diagnoses.
# ---------------------------------------------------------------------------

_QA_PROMPT = """Tum CareCrew ke ek caring health assistant ho. Kisi ne ek general sawaal poocha hai.
Tumhe GENTLE, HELPFUL jawab dena hai — lekin kabhi diagnosis ya dawai suggest NAHI karni. Agar sawaal
kisi specific symptom ke baare me hai, gently bolo ki Symptom Check try karein ya doctor review karenge.
Chhota jawab do (2-3 lines).

Sawaal: "{text}"

Jawab:"""

_SYMPTOM_HINT_WORDS = [
    "dard", "pain", "fever", "bukhar", "bukhaar", "khansi", "cough",
    "chakkar", "ulti", "vomiting", "saans", "breath", "takleef",
]

_QA_STUB_REPLY = (
    "That's a good question — I'm not able to give medical advice or a diagnosis here. "
    "If you're describing a symptom, try Symptom Check and a doctor will review it. "
    "For anything urgent, please contact a doctor directly."
)


def _match(text: str, patterns: list) -> dict | None:
    t = text.lower()
    for p in patterns:
        if any(kw in t for kw in p["keywords"]):
            return p
    return None


def _general_qa(text: str, role: str) -> dict:
    reply = None
    if settings.GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-3.6-flash", generation_config={"temperature": 0.4})
            resp = model.generate_content(_QA_PROMPT.format(text=text))
            reply = (resp.text or "").strip() or None
        except Exception as e:
            print(f"[bot_intent] general QA fallback to stub: {e}")
    if not reply:
        reply = _QA_STUB_REPLY

    action = None
    if role == "patient" and any(w in text.lower() for w in _SYMPTOM_HINT_WORDS):
        action = {"type": "navigate", "target": "chat", "label": "Start Symptom Check"}
    return {"reply": reply, "action": action}


def _last_visit_summary(patient_id: str) -> dict:
    if not patient_id:
        return {"reply": "Please log in to see your last visit details.", "action": None}

    from app.services.reports_store import case_report_store
    mine = [s for s in case_report_store.all() if s.patient_id == patient_id]
    if not mine:
        return {
            "reply": "You don't have any completed visits yet. Once you finish a Symptom Check, I'll be able to summarize it here.",
            "action": {"type": "navigate", "target": "chat", "label": "Start Symptom Check"},
        }

    mine.sort(key=lambda s: s.completed_at, reverse=True)
    latest = mine[0]

    from app.services import summary as summary_service
    text = summary_service.generate_summary(latest, "patient")
    return {"reply": text, "action": {"type": "navigate", "target": "reports", "label": "View All Reports"}}


def handle_query(text: str, role: str, patient_id: str = None) -> dict:
    """Returns {"reply": str, "action": {"type","target","label"} | None}."""
    t = (text or "").strip()
    if not t:
        return {"reply": "How may I help you? / Main aapki kya madad karun?", "action": None}

    if role == "doctor":
        match = _match(t, _DOCTOR_PATTERNS)
        if match:
            return {"reply": match["reply"], "action": {"type": "navigate", "target": match["target"], "label": match["label"]}}
        tl = t.lower()
        if any(kw in tl for kw in _DOCTOR_SUMMARY_KEYWORDS) or any(kw in tl for kw in _DOCTOR_PATIENT_DETAILS_KEYWORDS):
            return {"reply": _NO_PATIENT_CONTEXT_REPLY, "action": None}
        return _general_qa(t, role)

    # patient
    match = _match(t, _PATIENT_PATTERNS)
    if match:
        return {"reply": match["reply"], "action": {"type": "navigate", "target": match["target"], "label": match["label"]}}

    tl = t.lower()
    if any(kw in tl for kw in _PATIENT_LAST_VISIT_KEYWORDS):
        return _last_visit_summary(patient_id)

    return _general_qa(t, role)
