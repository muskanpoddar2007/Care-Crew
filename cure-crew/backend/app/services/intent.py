"""
Intent detection — decides WHAT the patient wants before anything else runs.

Three outcomes per message:
  "action"  -> patient wants the app to do something (book appointment, show
               reports, summarize). Rule-based keyword matching — deterministic,
               same "don't let the LLM drive the flow" philosophy as
               question_tree.py. No API key required.
  "symptom" -> patient is describing a health problem. Condition category +
               routing department are classified (Gemini when GEMINI_API_KEY is
               set, keyword stub otherwise — same fallback pattern as
               extraction.py) so the right question tree gets picked.
  "unclear" -> neither of the above — ask a gentle clarifying question.

Anurag: `python -m app.services.intent` runs the quick self-test at the bottom.
"""
import json
import re
from app.core.config import settings

# ---------------------------------------------------------------------------
# Action intent — rule-based, bilingual keyword matching.
# ---------------------------------------------------------------------------

_ACTION_PATTERNS = [
    {
        "target": "appointments",
        "label": "Book Appointment",
        "keywords": [
            "book appointment", "book an appointment", "appointment book",
            "doctor se milna", "doctor dikhana", "doctor ko dikhana",
            "appointment chahiye", "appointment lena", "milna hai doctor",
            "consultation book", "visit book",
        ],
    },
    {
        "target": "reports",
        "label": "View Reports",
        "keywords": [
            "show my reports", "show reports", "report dikhao", "reports dikhao",
            "mera report", "purani report", "previous report", "old reports",
            "diagnosis report", "report chahiye",
        ],
    },
    {
        "target": "summary",
        "label": "AI Summary",
        "keywords": [
            "summarize", "summary chahiye", "summary de do", "give me a summary",
            "case summary", "summary dikhao", "short summary",
        ],
    },
]


def detect_action(text: str) -> dict | None:
    """Returns a navigation action dict if the message is clearly an app
    action request, else None. Deterministic — never guesses."""
    t = (text or "").strip().lower()
    if not t:
        return None
    for pattern in _ACTION_PATTERNS:
        if any(kw in t for kw in pattern["keywords"]):
            return {"action": "navigate", "target": pattern["target"], "label": pattern["label"]}
    return None


# ---------------------------------------------------------------------------
# Condition classification — Gemini when available, keyword stub otherwise.
# ---------------------------------------------------------------------------

# Registry: condition_key -> (display name, routing department, trigger keywords
# for the stub classifier). New trees must be added to app/data/{key}.json too.
CONDITIONS = {
    "chest_pain": {
        "display_name": "Chest Pain / Seene mein dard",
        "department": "Cardiology",
        "keywords": ["chest", "seene", "seena", "dil", "heart"],
    },
    "fever": {
        "display_name": "Fever / Bukhaar",
        "department": "General Medicine",
        "keywords": ["fever", "bukhar", "bukhaar", "temperature", "thand lag"],
    },
    "cough_cold": {
        "display_name": "Cough & Cold / Khaansi-Zukaam",
        "department": "General Medicine",
        "keywords": ["cough", "khansi", "khaansi", "zukam", "zukaam", "cold", "gala", "throat", "naak"],
    },
    "stomach_pain": {
        "display_name": "Stomach / Abdominal Pain / Pet Dard",
        "department": "Gastroenterology",
        "keywords": ["stomach", "pet", "abdomen", "pait", "belly"],
    },
    "headache": {
        "display_name": "Headache / Sar Dard",
        "department": "General Medicine",
        "keywords": ["headache", "sar dard", "sir dard", "head pain", "migraine"],
    },
    "body_pain": {
        "display_name": "Body Pain / Badan Dard",
        "department": "General Medicine",
        "keywords": ["body pain", "badan dard", "joint pain", "muscle pain", "kamar dard", "back pain"],
    },
    "breathing_difficulty": {
        "display_name": "Breathing Difficulty / Saans ki Takleef",
        "department": "Pulmonology",
        "keywords": ["breath", "saans", "saas phool", "breathless", "dam ghutna"],
    },
}

_DEFAULT_DEPARTMENT = "General Medicine"

_CONDITION_PROMPT = """Tum ek medical triage classifier ho. Patient ne apni taklif bataayi hai.
Tumhara kaam hai iska condition category aur department pehchaanna — DIAGNOSIS nahi karna.

Patient ne kaha: "{text}"

In categories me se sabse relevant ek chuno: {options}
Agar in me se koi bhi theek se match nahi karta, "other" bolo.

SIRF ek JSON object do, koi extra text nahi:
{{"condition_key": "<ek option ya 'other'>", "department": "<jaise 'Cardiology', 'General Medicine', 'Gastroenterology', 'ENT', 'Orthopedics', 'Pulmonology', 'Dermatology'>"}}

JSON:"""


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def _stub_classify_condition(text: str) -> dict:
    """Keyword-matching fallback — used whenever no GEMINI_API_KEY is set."""
    t = (text or "").lower()
    for key, info in CONDITIONS.items():
        if any(kw in t for kw in info["keywords"]):
            return {"condition_key": key, "department": info["department"]}
    return {"condition_key": "other", "department": _DEFAULT_DEPARTMENT}


def classify_condition(text: str) -> dict:
    """Returns {"condition_key", "department", "display_name", "has_tree"}.
    condition_key is "other" when nothing matches — the dynamic question
    generator handles that case gracefully."""
    if not settings.GEMINI_API_KEY:
        result = _stub_classify_condition(text)
    else:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(
                "gemini-3.6-flash",
                generation_config={"temperature": 0, "response_mime_type": "application/json"},
            )
            options = ", ".join(list(CONDITIONS.keys()) + ["other"])
            prompt = _CONDITION_PROMPT.format(text=(text or "").strip(), options=options)
            resp = model.generate_content(prompt)
            data = _parse_json(resp.text)
            key = data.get("condition_key") or "other"
            if key not in CONDITIONS:
                key = "other"
            department = data.get("department") or CONDITIONS.get(key, {}).get("department", _DEFAULT_DEPARTMENT)
            result = {"condition_key": key, "department": department}
        except Exception as e:
            print(f"[intent] classify_condition fallback to stub: {e}")
            result = _stub_classify_condition(text)

    key = result["condition_key"]
    return {
        "condition_key": key,
        "department": result["department"],
        "display_name": CONDITIONS.get(key, {}).get("display_name", (text or "").strip()[:60] or "General complaint"),
        "has_tree": key in CONDITIONS,
    }


# ---------------------------------------------------------------------------
# Unclear-message heuristic — very short / greeting-only messages with no
# symptom or action content. Deliberately conservative: only fires when we're
# NOT already mid-symptom-description, so it can't derail an active tree.
# ---------------------------------------------------------------------------

_GREETING_ONLY = {
    "hi", "hello", "hey", "namaste", "hii", "helo", "yo",
    "ok", "okay", "acha", "achha", "theek hai", "thik hai", "hmm", "haan", "ha",
}


def classify_intent(text: str) -> str:
    """Top-level dispatcher for a message that hasn't picked a condition yet.
    Returns "action" | "symptom" | "unclear". Action detection always wins."""
    if detect_action(text):
        return "action"
    t = (text or "").strip().lower()
    if not t or t in _GREETING_ONLY or len(t) < 3:
        return "unclear"
    return "symptom"


_CORRECTION_PROMPT = """Tum ek medical assistant ho. Patient ne pehle bataya tha ki unki main problem '{current_condition}' hai.
Ab unhone naya message bheja hai: "{text}"

Kya is naye message mein patient apni main problem badal raha hai ya pehle wali problem ko mana kar raha hai? (Jaise: "fever nahi hai, pet me dard hai" ya "galti se fever bol diya").

Agar HAA (unhone problem badli hai ya purani wali ko 'nahi' bola hai):
{{ "is_correction": true, "new_complaint": "<unka naya symptom, agar bataya ho, nahi to 'none'>" }}

Agar NAHI (wo bas sawaal ka jawab de rahe hain, ya koi normal baat keh rahe hain):
{{ "is_correction": false }}

SIRF JSON do, koi extra text nahi.
JSON:"""

def detect_correction(text: str, current_condition_display: str) -> dict:
    """Detects if the user is explicitly correcting or negating their main complaint."""
    if not settings.GEMINI_API_KEY or not current_condition_display or len(text.split()) < 2:
        return {"is_correction": False}
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            "gemini-3.6-flash",
            generation_config={"temperature": 0, "response_mime_type": "application/json"},
        )
        prompt = _CORRECTION_PROMPT.format(text=text.strip(), current_condition=current_condition_display)
        resp = model.generate_content(prompt)
        data = _parse_json(resp.text)
        return data
    except Exception as e:
        print(f"[intent] detect_correction failed: {e}")
        return {"is_correction": False}


if __name__ == "__main__":
    tests = [
        "mujhe bukhar hai do din se",
        "pet mein dard ho raha hai khana khane ke baad",
        "doctor se appointment book karni hai",
        "mera report dikhao",
        "summary chahiye",
        "hi",
        "seene mein dard ho raha hai",
        "saans lene mein taklif ho rahi hai",
    ]
    for t in tests:
        print(f"{t!r:55} -> intent={classify_intent(t)!r} action={detect_action(t)}")
        if classify_intent(t) == "symptom":
            print(f"   condition={classify_condition(t)}")
    
    print("\n--- Correction Tests ---")
    c_tests = [
        ("fever nahi hai, actually mujhe pet me dard hai", "Fever / Bukhaar"),
        ("nahi, kal se ho raha hai", "Fever / Bukhaar"),
        ("galti se fever likh diya, mujhe khansi hai", "Fever / Bukhaar"),
    ]
    for txt, cond in c_tests:
        print(f"[{cond}] {txt!r} -> {detect_correction(txt, cond)}")
