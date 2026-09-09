"""
Floating-bot query intent — a SEPARATE intent space from services/intent.py.

services/intent.py classifies a SYMPTOM message into a condition category
(fever/stomach_pain/...) to drive the Symptom Check question tree. This
module answers a completely different question: "what does the user want the
APP to do" for the floating assistant widget — navigate somewhere, get a
last-visit summary, chat naturally, or explain what CareCrew does. It never
touches case-taking state and is never used by the Symptom Check flow.

Design:
1. A few DATA-BACKED special cases (last-visit summary, doctor patient-lookup)
   stay deterministic/keyword-driven — they need a real backend lookup the
   LLM can't safely fabricate, so the LLM is never trusted to invent report
   content.
2. The explicit "diagnose me / give me medicine" guardrail is ALSO
   deterministic and checked before any LLM call — non-negotiable, doesn't
   depend on the model behaving.
3. Everything else (greetings, app questions, navigation chat, empathetic
   small talk, symptom mentions) is genuinely LLM-driven: Groq PRIMARY
   (llama-3.3-70b-versatile), Gemini fallback, then a rule-based reply — never
   the same canned line for every message, and never a crash.
"""
import json
import re

from app.core.config import settings

# ---------------------------------------------------------------------------
# Navigation vocabulary — must match window.CareCrewNav.goTo's real targets
# (frontend/js/app.js). "prescriptions" has a backend API but no UI screen
# yet, so it's deliberately NOT a navigable target here.
# ---------------------------------------------------------------------------

_NAV_LABELS = {
    "chat": "Start Symptom Check",
    "reports": "View Reports",
    "appointments": "Book Appointment",
    "doctor_appointments": "View Appointments",
    "profile": "View Profile",
    "dashboard": "Go to Dashboard",
}
_PATIENT_TARGETS = {"chat", "reports", "appointments", "profile", "dashboard"}
_DOCTOR_TARGETS = {"doctor_appointments", "profile", "dashboard"}


def _nav_action(target: str) -> dict:
    return {"type": "navigate", "target": target, "label": _NAV_LABELS[target]}


# ---------------------------------------------------------------------------
# Rule-based navigation keyword patterns — used both as the fully-offline
# fallback AND to keep old direct phrasings working even when the LLM is up.
# ---------------------------------------------------------------------------

_PATIENT_PATTERNS = [
    {
        "target": "reports",
        "reply": "Sure — here are your reports.",
        "keywords": [
            "show my report", "show reports", "has my report", "report aaya",
            "mera report", "reports dikhao", "report dikhao", "my reports",
            "mere reports", "mere reports dikhao",
        ],
    },
    {
        "target": "appointments",
        "reply": "Sure, let's get an appointment booked for you.",
        "keywords": [
            "book appointment", "book an appointment", "appointment book",
            "doctor se milna", "appointment chahiye", "milna hai doctor",
        ],
    },
]

_DOCTOR_PATTERNS = [
    {
        "target": "doctor_appointments",
        "reply": "Here are today's appointments.",
        "keywords": [
            "today's appointments", "todays appointments", "aaj ki appointment",
            "appointment list", "today appointment",
        ],
    },
]

_PATIENT_LAST_VISIT_KEYWORDS = [
    "last visit", "pichli visit", "last appointment", "purani visit", "previous visit",
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
# HARD GUARDRAIL — explicit diagnosis/medicine request. Deterministic, checked
# before the LLM is even called, so it can never be talked out of this.
# ---------------------------------------------------------------------------

_EXPLICIT_MEDICAL_ASK_KEYWORDS = [
    "diagnosis", "diagnose me", "mujhe kya bimari", "mujhe kaunsi bimari",
    "kya bimari hai", "kaunsi bimari hai", "which disease do i have",
    "what disease do i have", "kaunsi dawai loon", "kaunsi dawai lu",
    "which medicine should i", "what medicine should i", "dawai batao",
    "medicine batao", "tablet batao", "prescribe me", "dawai suggest karo",
]

_GUARDRAIL_LINE = {
    "hi": "मैं diagnosis नहीं कर सकता — structured history के लिए Symptom Check का उपयोग करें, डॉक्टर उसे review करेंगे।",
    "hinglish": "Main diagnosis nahi kar sakta, structured history ke liye Symptom Check use karein aur doctor review karega.",
    "en": "I can't provide a diagnosis — please use Symptom Check for a structured history, and a doctor will review it.",
}

# Symptom-mention safety net — if the LLM's reply somehow comes back without
# a navigate action while the patient is clearly describing a symptom, force
# the redirect ourselves rather than leaving them stuck in general chat.
_SYMPTOM_HINT_WORDS = [
    "dard", "pain", "fever", "bukhar", "bukhaar", "khansi", "cough",
    "chakkar", "ulti", "vomiting", "saans", "breath", "takleef",
]

# ---------------------------------------------------------------------------
# Rule-based intents for the fully-offline path (no Groq/Gemini key at all).
# Deliberately NOT one blanket disclaimer for everything.
# ---------------------------------------------------------------------------

_GREETING_WORDS = {"hi", "hii", "hiii", "hello", "hey", "heyy", "namaste", "namaskar", "yo"}
_APP_INFO_KEYWORDS = [
    "yeh app kya", "ye app kya", "this app do", "what is carecrew",
    "carecrew kya", "kaise kaam karta", "kaise kaam karti", "how does this app work",
    "how do i use", "app kaise use", "what can this app",
]

_GREETING_REPLY = {
    "en": "Hey! I'm the CareCrew assistant. I can help you start a Symptom Check, view your Reports or Appointments, or answer questions about the app — what would you like to do?",
    "hi": "नमस्ते! मैं CareCrew असिस्टेंट हूँ। मैं आपकी Symptom Check शुरू करने, Reports या Appointments देखने, या ऐप के बारे में सवालों में मदद कर सकता हूँ — आप क्या करना चाहेंगे?",
    "hinglish": "Hey! Main CareCrew assistant hoon. Main aapki Symptom Check shuru karne, Reports ya Appointments dekhne, ya app ke baare me sawaalon me madad kar sakta hoon — aap kya karna chahenge?",
}
_APP_DESCRIPTION = {
    "en": "CareCrew lets you describe your symptoms in your own words — our AI asks a few guided questions and builds a structured case sheet with any urgent red flags highlighted, so your doctor gets a head start. You can also check past Reports, book Appointments, and view your Profile from the Dashboard.",
    "hi": "CareCrew में आप अपनी तकलीफ़ अपनी भाषा में बताते हैं — AI कुछ गाइडेड सवाल पूछता है और एक structured केस शीट बनाता है जिसमें ज़रूरी red flags भी हाइलाइट होते हैं, ताकि डॉक्टर को शुरुआत मिल जाए। आप अपनी पुरानी Reports देख सकते हैं, Appointments बुक कर सकते हैं, और Dashboard से Profile भी देख सकते हैं।",
    "hinglish": "CareCrew me aap apni taklif apni bhasha me bataate hain — AI kuch guided sawaal poochta hai aur ek structured case sheet banata hai jisme zaroori red flags bhi highlight hote hain, taaki doctor ko shuruaat mil jaaye. Aap apni purani Reports dekh sakte hain, Appointments book kar sakte hain, aur Dashboard se Profile bhi dekh sakte hain.",
}
_GENERIC_FALLBACK_REPLY = {
    "en": "I can help you navigate CareCrew — start a Symptom Check, check your Reports or Appointments, or just tell me a bit more about what's on your mind.",
    "hi": "मैं आपकी CareCrew में मदद कर सकता हूँ — Symptom Check शुरू करें, अपनी Reports या Appointments देखें, या मुझे थोड़ा और बताइए।",
    "hinglish": "Main aapki CareCrew me madad kar sakta hoon — Symptom Check shuru karein, apni Reports ya Appointments dekhein, ya mujhe thoda aur bataiye ki aapke man me kya hai.",
}
_SYMPTOM_ACK_REPLY = {
    "en": "I'm sorry to hear that. Let's get this looked at properly — Symptom Check will ask a few quick questions and prepare a case sheet for your doctor.",
    "hi": "ये सुनकर अफ़सोस हुआ। चलिए इसे सही तरीके से देखते हैं — Symptom Check कुछ जल्दी सवाल पूछेगा और आपके डॉक्टर के लिए एक केस शीट तैयार करेगा।",
    "hinglish": "Ye sunke afsos hua. Chaliye ise sahi tarike se dekhte hain — Symptom Check kuch jaldi sawaal poochega aur aapke doctor ke liye ek case sheet taiyaar karega.",
}
_EMPTY_PROMPT_REPLY = "How may I help you? / Main aapki kya madad karun?"

_LANG_NAMES = {"hi": "Hindi (Devanagari script)", "hinglish": "Hinglish (Hindi-English mix, Roman script)", "en": "English"}


def _lang_key(lang: str) -> str:
    return lang if lang in ("hi", "hinglish") else "en"


def _matches_any(text: str, phrases: list) -> bool:
    t = text.lower()
    return any(p in t for p in phrases)


def _is_greeting(text: str) -> bool:
    """Word-exact match (not substring) — 'history' must never match 'hi'."""
    tokens = re.findall(r"[a-zA-Zऀ-ॿ]+", text.lower())
    return bool(tokens) and len(tokens) <= 3 and any(tok in _GREETING_WORDS for tok in tokens)


def _match(text: str, patterns: list) -> dict | None:
    t = text.lower()
    for p in patterns:
        if any(kw in t for kw in p["keywords"]):
            return p
    return None


def _last_visit_summary(patient_id: str) -> dict:
    if not patient_id:
        return {"reply": "Please log in to see your last visit details.", "action": None}

    from app.services.reports_store import case_report_store
    mine = [s for s in case_report_store.all() if s.patient_id == patient_id]
    if not mine:
        return {
            "reply": "You don't have any completed visits yet. Once you finish a Symptom Check, I'll be able to summarize it here.",
            "action": _nav_action("chat"),
        }

    mine.sort(key=lambda s: s.completed_at, reverse=True)
    latest = mine[0]

    from app.services import summary as summary_service
    text = summary_service.generate_summary(latest, "patient")
    return {"reply": text, "action": _nav_action("reports")}


def _rule_based_reply(text: str, role: str, lang_key: str) -> dict:
    """No LLM available at all — best-effort, but never one blanket
    disclaimer for every message. Greetings, nav requests, and app questions
    all get an honest, specific reply; only genuinely free-form text gets a
    generic (still non-medical) nudge."""
    if _is_greeting(text):
        return {"reply": _GREETING_REPLY[lang_key], "action": None}

    if _matches_any(text, _APP_INFO_KEYWORDS):
        return {"reply": _APP_DESCRIPTION[lang_key], "action": None}

    patterns = _DOCTOR_PATTERNS if role == "doctor" else _PATIENT_PATTERNS
    match = _match(text, patterns)
    if match:
        return {"reply": match["reply"], "action": _nav_action(match["target"])}

    if role == "patient" and _matches_any(text, _SYMPTOM_HINT_WORDS):
        return {"reply": _SYMPTOM_ACK_REPLY[lang_key], "action": _nav_action("chat")}

    return {"reply": _GENERIC_FALLBACK_REPLY[lang_key], "action": None}


# ---------------------------------------------------------------------------
# Session-based context memory — best-effort, in-memory (same "no new DB,
# in-memory is fine at this scale" convention as the rest of the backend).
# Keyed by user id since the bot widget has no separate session concept.
# ---------------------------------------------------------------------------

_MAX_EXCHANGES = 6
_history: dict = {}


def _get_history(user_id: str) -> list:
    return _history.get(user_id, [])


def _remember(user_id: str, user_text: str, bot_reply: str) -> None:
    hist = _history.setdefault(user_id, [])
    hist.append({"role": "user", "content": user_text})
    hist.append({"role": "assistant", "content": bot_reply})
    del hist[: -_MAX_EXCHANGES * 2]


def _history_block(history: list) -> str:
    if not history:
        return "(koi purani baat nahi — ye conversation ka pehla message hai)"
    lines = [f"{'User' if h['role'] == 'user' else 'Assistant'}: {h['content']}" for h in history]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# LLM-driven reply — Groq primary, Gemini fallback.
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """Tum CareCrew app ke floating AI assistant ho — ek chhota, friendly
navigation + Q&A widget jo har page par available rehta hai. Tum KHUD patient history-taking
(Symptom Check) nahi karte — wo ek alag dedicated flow hai jiske paas tum sirf user ko BHEJ sakte ho.

CAREREW APP KE BAARE ME (jab poocha jaaye to accurately samjhao):
- CareCrew Indian OPD/PHC clinics ke liye bana AI-assisted patient history-taking + triage app hai.
- Symptom Check: patient apni taklif apni bhasha me batata hai, AI clinically-guided sawaal poochta
  hai, aur ek structured, evidence-linked case sheet banti hai jisme red-flag alerts bhi hote hain —
  doctor phir usi case sheet ko review karta hai. AI kabhi khud diagnosis nahi deta.
- Reports: patient ke pichhle completed Symptom Check sessions/case sheets yahan dikhte hain.
- Appointments: patient department chunke appointment request karta hai; doctor apne department
  ki appointments yahan dekhta hai.
- Profile: patient/doctor ka ID card — naam, role, department/specialty, contact details.
- Dashboard: home/overview screen jahan se baaki sab shuru hota hai.
- Prescriptions ek upcoming backend feature hai — abhi app ki UI me isko navigate karne ka option
  NAHI hai. Agar koi ispe poochhe, bata do ki ye abhi app me available nahi hai.

TUMHARA ROLE: {role}
USER KI LANGUAGE: {lang_name} — HAMESHA isi language me jawab do.

BEHAVIOUR RULES:
1. Greeting / small talk / general baat ka natural, human jaisa jawab do. Plain greeting
   ("hi"/"hello"/"namaste") par KOI medical disclaimer mat jodo — bas warmly greet karo.
2. Jab user CareCrew ke baare me poochhe, upar diye gaye knowledge se accurately samjhao.
3. Jab user kisi cheez pe navigate karna chahe, reply do AUR "action" me
   {{"type":"navigate","target":"<TARGET>","label":"<button text>"}} bhejo.
   {targets_line}
   Agar navigate karne ki zaroorat nahi hai, "action": null bhejo.
4. Neeche di gayi CONVERSATION HISTORY yaad rakho — follow-up sawaal ka context samajh ke jawab do.
5. Agar user pareshan/dukhi lag raha hai, warm aur reassuring bolo, phir sahi jagah bhejo.
6. Agar user koi symptom describe kare (dard, bukhaar, khaansi, chakkar, etc.), pehle uski baat
   ko acknowledge karo, phir gently Symptom Check try karne ko bolo — action me target="chat"
   bhejo. Kis bimari ka shak hai ya kya ho sakta hai — kuch mat bolo, sirf history lene bhejo.

HARD RULES — kabhi mat todna:
- Kabhi diagnosis mat do, kisi bimari ka naam mat lo (jaise "aapko X hai"), koi dawai/dosage
  suggest mat karo.
- Sirf jab user EXPLICITLY diagnosis ya dawai maange, tabhi ye exact line bolo: "{guardrail_line}"
  — baaki kisi bhi turn par ye line mat dohrao.

OUTPUT — SIRF ye ek JSON object return karo, koi markdown/extra text nahi:
{{"reply": "<tumhara jawab, {lang_name} me>", "action": null ya {{"type":"navigate","target":"<target>","label":"<short button text>"}}}}

CONVERSATION HISTORY:
{history_block}

USER KA NAYA MESSAGE: "{message}"

JSON:"""


def _build_prompt(text: str, role: str, lang_key: str, history: list) -> str:
    targets = _PATIENT_TARGETS if role == "patient" else _DOCTOR_TARGETS
    targets_line = "VALID TARGETS (sirf inhi me se ek use karo): " + ", ".join(sorted(targets))
    return _SYSTEM_PROMPT.format(
        role=role,
        lang_name=_LANG_NAMES[lang_key],
        targets_line=targets_line,
        guardrail_line=_GUARDRAIL_LINE[lang_key],
        history_block=_history_block(history),
        message=text,
    )


def _parse_json(text: str) -> dict:
    """Model kabhi-kabhi ``` ya extra text de deta hai — usme se JSON nikaalo."""
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def _call_groq(prompt: str) -> str:
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content


def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        "gemini-3.6-flash",
        generation_config={"temperature": 0.4, "response_mime_type": "application/json"},
    )
    resp = model.generate_content(prompt)
    return resp.text


def _llm_reply(text: str, role: str, lang_key: str, history: list) -> dict | None:
    """Returns {reply, action} from Groq/Gemini, or None if both are
    unavailable/fail — caller falls back to _rule_based_reply()."""
    prompt = _build_prompt(text, role, lang_key, history)

    raw = None
    if settings.GROQ_API_KEY:
        try:
            raw = _call_groq(prompt)
        except Exception as e:
            print(f"[bot_intent] Groq failed, falling back: {e}")

    if raw is None and settings.GEMINI_API_KEY:
        try:
            raw = _call_gemini(prompt)
        except Exception as e:
            print(f"[bot_intent] Gemini fallback failed: {e}")

    if raw is None:
        return None

    try:
        data = _parse_json(raw)
    except Exception as e:
        print(f"[bot_intent] JSON parse failed: {e}")
        return None

    reply = (data.get("reply") or "").strip()
    if not reply:
        return None

    action = data.get("action")
    valid_targets = _PATIENT_TARGETS if role == "patient" else _DOCTOR_TARGETS
    if isinstance(action, dict) and action.get("type") == "navigate" and action.get("target") in valid_targets:
        action = _nav_action(action["target"])
    else:
        action = None

    return {"reply": reply, "action": action}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def handle_query(text: str, role: str, patient_id: str = None, lang: str = "en") -> dict:
    """Returns {"reply": str, "action": {"type","target","label"} | None}."""
    t = (text or "").strip()
    if not t:
        return {"reply": _EMPTY_PROMPT_REPLY, "action": None}

    lang_key = _lang_key(lang)
    user_id = patient_id or "anon"

    # 1. HARD guardrail — explicit diagnosis/medicine ask. Deterministic,
    #    never routed through the LLM at all.
    if _matches_any(t, _EXPLICIT_MEDICAL_ASK_KEYWORDS):
        result = {
            "reply": _GUARDRAIL_LINE[lang_key],
            "action": _nav_action("chat") if role == "patient" else None,
        }
        _remember(user_id, t, result["reply"])
        return result

    # 2. Data-backed special cases — need a real lookup the LLM can't fabricate.
    if role == "doctor":
        if _matches_any(t, _DOCTOR_SUMMARY_KEYWORDS) or _matches_any(t, _DOCTOR_PATIENT_DETAILS_KEYWORDS):
            _remember(user_id, t, _NO_PATIENT_CONTEXT_REPLY)
            return {"reply": _NO_PATIENT_CONTEXT_REPLY, "action": None}
    elif _matches_any(t, _PATIENT_LAST_VISIT_KEYWORDS):
        result = _last_visit_summary(patient_id)
        _remember(user_id, t, result["reply"])
        return result

    # 3. Everything else — genuinely LLM-driven, with a rule-based safety net.
    history = _get_history(user_id)
    result = _llm_reply(t, role, lang_key, history) or _rule_based_reply(t, role, lang_key)

    # 4. Safety net: a patient describing a symptom always gets nudged to
    #    Symptom Check, even if the LLM forgot to attach the action.
    if role == "patient" and result.get("action") is None and _matches_any(t, _SYMPTOM_HINT_WORDS):
        result = {"reply": result["reply"], "action": _nav_action("chat")}

    _remember(user_id, t, result["reply"])
    return result
