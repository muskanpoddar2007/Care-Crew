import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from app.models.case_sheet import CaseSheet, Evidence
from app.core import session_store
from app.services import question_tree, extraction, red_flags, intent, dynamic_questions
from app.services.reports_store import case_report_store
from app.data.reference_transcripts import (
    AYURVEDA_CORE_QUESTIONS,
    AYURVEDA_BRANCH_QUESTIONS,
    ALLOPATHIC_SKELETON_QUESTIONS,
)

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

_FILLERS = {"ok", "okay", "k", "hmm", "hm", "..", "...", "?", "acha", "achha"}
_MAX_MISSES = 2


def _get_flag_id(flag: Any) -> Any:
    if hasattr(flag, "id"):
        return flag.id
    if isinstance(flag, dict) and "id" in flag:
        return flag["id"]
    return flag


def _is_low_signal(text: str) -> bool:
    t = (text or "").strip().lower()
    if not t:
        return True
    return t in _FILLERS


def _detect_language(text: str) -> Optional[str]:
    t = (text or "").strip().lower()
    if re.search(r"\b(hinglish|हिंग्लिश)\b", t):
        return "hinglish"
    if re.search(r"\b(english|eng|अंग्रेजी|अंग्रेज़ी)\b", t):
        return "english"
    if re.search(r"\b(hindi|hin|हिंदी|हिन्दी)\b", t):
        return "hindi"
    return None


def _detect_mode(text: str) -> Optional[str]:
    t = (text or "").strip().lower()
    if re.search(r"\b(ayurved|ayurveda|आयुर्वेद|ayurvedic)\b", t):
        return "ayurveda"
    if re.search(r"\b(allopath|allopathic|english medicine|modern medicine|एलोपैथ|एलोपैथिक)\b", t):
        return "allopathic"
    return None


def _translate(lang: Optional[str], english: str, hinglish: str, hindi: str) -> str:
    if lang == "hindi":
        return hindi
    if lang == "english":
        return english
    return hinglish  # default to hinglish


def _classify_category(text: str, mode: Optional[str]) -> str:
    t = (text or "").lower()
    if mode == "ayurveda":
        if any(w in t for w in ("knee", "joint", "sandhi", "stiff", "swelling", "ghutna", "kamar", "muscle", "back", "painkiller")):
            return "joint_muscle"
        if any(w in t for w in ("bloat", "acidity", "gas", "pet", "kabz", "constipat", "digestion", "indigestion", "stool", "motion")):
            return "digestive"
        if any(w in t for w in ("rash", "itch", "khujli", "dry", "flaky", "skin", "chamdi", "daane")):
            return "skin"
        if any(w in t for w in ("sleep", "neend", "stress", "tension", "mind", "bechaini", "racing", "anxiety", "insomnia")):
            return "anxiety_sleep"
        return "general"

    # Allopathic mode categories
    if any(w in t for w in ("jalan", "burning", "acidity", "sour", "khatta", "reflux", "burp", "belch", "mithai")):
        return "gastric"
    if any(w in t for w in ("cough", "khansi", "fever", "bukhar", "phlegm", "balgam", "yellowish", "infection")):
        return "infective"
    if any(w in t for w in ("furniture", "heavy", "boxes", "muscle", "strain", "arm upar", "twist", "press")):
        return "musculoskeletal"
    if any(w in t for w in ("stress", "tension", "office", "exam", "fast dhadak", "palpitation", "racing", "ghabrahat")):
        return "anxiety"
    if any(w in t for w in ("dinner", "heavy meal", "khana khane ke baad", "10:30", "so jaati")):
        return "post-meal"
    if any(w in t for w in ("purani", "history", "previous", "pehle bhi", "2 saal", "dusre hospital", "reports", "old report")):
        return "prior_history"
    if any(w in t for w in ("chest", "seena", "seene", "dil", "heart", "left arm", "shoulder", "jaw", "pressure", "heaviness", "stairs", "sweating", "saans")):
        return "cardiac-pattern"
    return "cardiac-pattern" if "pain" in t or "dard" in t else "general"


def _set_slot(sheet: CaseSheet, slot: str, patch: dict, turn_index: int) -> bool:
    """Sets extracted value + evidence into the dotted slot path or collected fields."""
    value = patch.get("value")
    if value in (None, "", []):
        logger.info(f"No usable extraction for slot={slot} turn={turn_index}")
        return False

    sheet.collected_fields[slot] = value
    parts = slot.split(".")
    ev = Evidence(value=str(value), evidence=patch.get("evidence") or str(value), turn_index=turn_index)

    try:
        if len(parts) == 1:
            attr = getattr(sheet, parts[0], None)
            if isinstance(attr, list):
                attr.append(str(value))
            elif hasattr(sheet, parts[0]):
                setattr(sheet, parts[0], ev)
            else:
                sheet.review_of_systems[parts[0]] = ev.model_dump()

        elif len(parts) == 2:
            parent, child = parts
            if parent == "ayurveda":
                sheet.review_of_systems[f"ayurveda_{child}"] = ev.model_dump()
                return True

            obj = getattr(sheet, parent, None)
            if obj is None:
                sheet.review_of_systems[slot.replace(".", "_")] = ev.model_dump()
                return True

            if isinstance(obj, dict):
                obj[child] = ev.model_dump()
            else:
                setattr(obj, child, ev)
        else:
            sheet.review_of_systems[slot.replace(".", "_")] = ev.model_dump()

    except AttributeError:
        sheet.review_of_systems[slot.replace(".", "_")] = ev.model_dump()

    return True


def _remaining_slots(sheet: CaseSheet) -> list:
    if sheet.condition_key is None:
        return []
    if sheet.tree_source == "predefined":
        tree = question_tree.load_tree(sheet.condition_key)
        return question_tree.remaining_slots(sheet, tree)
    return dynamic_questions.remaining_dynamic_slots(sheet)


def _all_slots(sheet: CaseSheet) -> list:
    if sheet.condition_key is None:
        return []
    if sheet.tree_source == "predefined":
        tree = question_tree.load_tree(sheet.condition_key)
        return question_tree.all_slots(tree)
    return dynamic_questions.remaining_dynamic_slots(sheet)


def _apply_patches(sheet: CaseSheet, patches: dict, turn_index: int, primary_slot: str) -> bool:
    primary_success = False
    for slot, patch in patches.items():
        wrote = _set_slot(sheet, slot, patch, turn_index)
        if slot == primary_slot:
            primary_success = wrote
    return primary_success


def _force_not_recorded(sheet: CaseSheet, slot: str, turn_index: int) -> None:
    _set_slot(sheet, slot, {"value": "Not recorded", "evidence": None}, turn_index)
    sheet.retry_counts.pop(slot, None)


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
    if sheet.is_complete and sheet.patient_id:
        sheet.completed_at = datetime.now(timezone.utc)
        case_report_store.save(sheet.session_id, sheet)


def _acknowledge(sheet: CaseSheet) -> str:
    lang = sheet.language or "hinglish"
    if lang == "english":
        pool = [
            "I understand, thank you for clarifying that.",
            "That is important to note, thank you.",
            "Understood, that helps give a clear picture.",
            "I have noted that down.",
        ]
        return pool[sheet.turn_count % len(pool)]
    if lang == "hindi":
        pool = [
            "समझ गया, बताने के लिए धन्यवाद।",
            "ठीक है, यह जानना जरूरी था।",
            "मैंने यह नोट कर लिया है।",
        ]
        return pool[sheet.turn_count % len(pool)]
    return _ACK_POOL[sheet.turn_count % len(_ACK_POOL)]


def _rephrase(sheet: CaseSheet, question_text: str) -> str:
    prefix = _REPHRASE_PREFIXES[sheet.turn_count % len(_REPHRASE_PREFIXES)]
    return f"{prefix}{question_text}"


def _response(
    sheet: CaseSheet,
    next_question: Optional[str],
    next_slot: Optional[str],
    extraction_succeeded: bool,
    new_flags: list,
    action: Optional[dict],
    quick_replies: Optional[list[str]] = None,
) -> Dict[str, Any]:
    options = quick_replies if quick_replies is not None else (sheet.pending_options or [])
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
        "quick_replies": options,
        "stage": sheet.stage,
        "mode": sheet.mode,
        "language": sheet.language,
        "category": sheet.category,
        "mcq_questions_asked": sheet.mcq_questions_asked,
    }


def start_session(complaint: str = None, patient_id: str = None) -> Dict[str, Any]:
    """Initializes a new diagnostic session."""
    session_id = str(uuid.uuid4())[:8]
    sheet = CaseSheet(session_id=session_id, turn_count=0, patient_id=patient_id)

    if complaint:
        sheet.condition_key = complaint
        sheet.category = complaint
        sheet.department = intent.CONDITIONS.get(complaint, {}).get("department")
        sheet.tree_source = "predefined" if question_tree.has_tree(complaint) else "dynamic"
        sheet.stage = "branching"
        sheet.mode = "allopathic"
        sheet.language = "hinglish"
        session_store.save(sheet)
        tree = question_tree.load_tree(complaint)
        return {
            "session_id": session_id,
            "next_question": tree.get("opening_question"),
            "next_slot": "hopi.onset",
            "is_urgent": False,
            "is_complete": False,
            "action": None,
            "condition_key": sheet.condition_key,
            "department": sheet.department,
            "quick_replies": [],
            "stage": sheet.stage,
            "mode": sheet.mode,
            "language": sheet.language,
            "category": sheet.category,
            "mcq_questions_asked": 0,
        }

    # Normal Entry Point: Language selection
    sheet.stage = "language_select"
    options = ["English", "Hindi", "Hinglish"]
    sheet.pending_options = options
    session_store.save(sheet)

    opener = "Namaste! Which language would you like to use — English, Hindi, or Hinglish?"
    return {
        "session_id": session_id,
        "next_question": opener,
        "next_slot": "language_select",
        "is_urgent": False,
        "is_complete": False,
        "action": None,
        "condition_key": None,
        "department": None,
        "quick_replies": options,
        "stage": "language_select",
        "mode": None,
        "language": None,
        "category": None,
        "mcq_questions_asked": 0,
    }


def _get_next_ayurveda_question(sheet: CaseSheet) -> Optional[dict]:
    # 1. Dynamic Core questions (always first)
    for q in AYURVEDA_CORE_QUESTIONS:
        slot = q["slot"]
        if slot not in sheet.collected_fields:
            text = q["question"].get(sheet.language, q["question"]["hinglish"])
            return {"slot": slot, "text": text, "options": q["options"], "is_mcq": q["is_mcq"], "phase": "core"}

    sheet.ayurveda_core_collected = True

    # 2. Problem-Focused Branching
    cat = sheet.category or "general"
    branch_qs = AYURVEDA_BRANCH_QUESTIONS.get(cat, AYURVEDA_BRANCH_QUESTIONS["general"])
    for q in branch_qs:
        slot = q["slot"]
        if slot not in sheet.collected_fields:
            text = q["question"].get(sheet.language, q["question"]["hinglish"])
            return {"slot": slot, "text": text, "options": q.get("options"), "is_mcq": q.get("is_mcq", False), "phase": "branch"}

    return None


def _get_next_allopathic_question(sheet: CaseSheet) -> Optional[dict]:
    for q in ALLOPATHIC_SKELETON_QUESTIONS:
        slot = q["slot"]
        if slot not in sheet.collected_fields:
            # Check category-specific tailoring
            text = q["question"].get(sheet.language, q["question"]["hinglish"])
            opts = q.get("options")
            is_mcq = q.get("is_mcq", False)

            # Tailor options/question for category
            cat = sheet.category or "cardiac-pattern"
            if slot == "hopi.aggravating" and cat == "gastric":
                if sheet.language == "english":
                    text = "Does the discomfort worsen after meals, especially heavy or spicy food, or when lying down?"
                elif sheet.language == "hindi":
                    text = "क्या यह परेशानी खाना खाने के बाद या लेटने पर बढ़ती है?"
                else:
                    text = "Khana khaane ke baad ya dinner ke baad letne par jalan badhti hai?"
                opts = ["After heavy meals", "When lying down", "Both meals and lying down", "Unrelated to meals"]
                is_mcq = True

            elif slot == "hopi.aggravating" and cat == "musculoskeletal":
                if sheet.language == "english":
                    text = "Does arm movement, twisting your body, or pressing on the chest increase the pain?"
                elif sheet.language == "hindi":
                    text = "क्या हाथ हिलाने, मुड़ने या दबाने से दर्द बढ़ता है?"
                else:
                    text = "Haath move karne, body turn karne ya particular point ko press karne par pain badhta hai?"
                opts = ["Worse with arm movement", "Tender on pressing", "Both movement and pressing", "Neither"]
                is_mcq = True

            return {"slot": slot, "text": text, "options": opts, "is_mcq": is_mcq}

    return None


def _close_session(sheet: CaseSheet) -> Dict[str, Any]:
    # Ensure minimum 4 MCQ questions asked requirement
    if sheet.mcq_questions_asked < 4:
        if "hopi.severity" not in sheet.collected_fields:
            slot = "hopi.severity"
            q_text = _translate(
                sheet.language,
                english="How much pain or discomfort are you experiencing right now?",
                hinglish="Abhi dard kitna tez hai? Mild, Moderate ya High?",
                hindi="अभी दर्द कितना तीव्र है? हल्का, मध्यम या बहुत अधिक?",
            )
            options = ["Mild", "Moderate", "High / Severe"]
            sheet.pending_options = options
            sheet.mcq_questions_asked += 1
            session_store.save(sheet)
            return _response(sheet, q_text, slot, True, [], None, options)

        if "hopi.timing" not in sheet.collected_fields:
            slot = "hopi.timing"
            q_text = _translate(
                sheet.language,
                english="How long does each episode usually last?",
                hinglish="Dard kitni der tak rehta hai?",
                hindi="दर्द आमतौर पर कितनी देर रहता है?",
            )
            options = ["A few seconds", "A few minutes", "Over an hour", "Continuous / All day"]
            sheet.pending_options = options
            sheet.mcq_questions_asked += 1
            session_store.save(sheet)
            return _response(sheet, q_text, slot, True, [], None, options)

    # Complete the consultation
    sheet.is_complete = True
    sheet.stage = "closing"
    sheet.pending_options = []
    _maybe_persist_report(sheet)
    session_store.save(sheet)

    if sheet.mode == "ayurveda":
        close_msg = _translate(
            sheet.language,
            english="Thank you. I have recorded your history. I will connect you to booking appointment section so our doctor can review your consultation.",
            hinglish="Thank you. Maine aapki history record kar li hai. Main aapko booking appointment section se connect kar raha hoon taaki doctor aapka case sheet review karein.",
            hindi="धन्यवाद। मैंने आपकी पूरी जानकारी दर्ज कर ली है। अब मैं आपको अपॉइंटमेंट बुकिंग अनुभाग से जोड़ रहा हूँ ताकि डॉक्टर आपके मामले की समीक्षा कर सकें।",
        )
    else:
        close_msg = _translate(
            sheet.language,
            english="Thank you. I have recorded your clinical history. Our doctor will review your case sheet thoroughly. Connecting you to review your case sheet and book an appointment.",
            hinglish="Theek hai. Maine aapki details record kar li hain. Doctor reports aur case sheet aane ke baad detail mein dekhenge. Main aapko booking appointment section se connect kar raha hoon.",
            hindi="ठीक है, मैंने आपके सभी विवरण दर्ज कर लिए हैं। डॉक्टर आपकी केस शीट की पूरी समीक्षा करेंगे। अब मैं आपको अपॉइंटमेंट बुकिंग अनुभाग से जोड़ रहा हूँ।",
        )

    return _response(sheet, close_msg, None, True, [], None, [])


def process_turn(
    session_id: str,
    patient_text: str,
    asked_slot: str,
    complaint: str = None,
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

    # 1. Action intent check
    action = intent.detect_action(patient_text)
    if action:
        session_store.save(sheet)
        ack = f"Bilkul, main aapki madad karta hoon — '{action['label']}' dabaiye."
        return _response(
            sheet,
            next_question=ack,
            next_slot=asked_slot,
            extraction_succeeded=False,
            new_flags=[],
            action=action,
            quick_replies=sheet.pending_options or [],
        )

    # 2. Check medicine asking rule in Allopathic mode ("can I take medicine right now?")
    t_lower = (patient_text or "").lower()
    asks_medicine = any(w in t_lower for w in ("koi medicine", "take something", "dawai", "painkiller", "tablet", "kuch le sakti hoon", "kuch le sakta hoon"))
    med_rule_prefix = ""
    if asks_medicine and sheet.mode == "allopathic":
        med_rule_prefix = (
            "Abhi bina proper assessment ke specific medicine start nahi karenge. "
            "Agar pain severe ho, saans bahut zyada phoolne lage, behoshi jaisa lage, ya pain rapidly worsen ho, toh immediately emergency/triage mein jaiye.\n\n"
        )

    # 3. Check old reports mention in Allopathic mode
    mentions_reports = any(w in t_lower for w in ("old report", "purani report", "dusre hospital", "prescription", "photo"))
    report_rule_prefix = ""
    if mentions_reports and sheet.mode == "allopathic":
        report_rule_prefix = "Aap purani reports app mein upload kar dijiye, doctor unhe current history ke saath review kar lenge.\n\n"

    # ==========================================
    # STAGE: language_select
    # ==========================================
    if sheet.stage == "language_select":
        lang = _detect_language(patient_text)
        if lang:
            sheet.language = lang
            sheet.stage = "mode_select"
            mode_q = _translate(
                lang,
                english="Would you like to continue in **Ayurveda mode** or **English Medicine mode**?",
                hinglish="Aap **Ayurveda mode** mein aage badhna chahenge ya **English Medicine (Allopathic) mode** mein?",
                hindi="क्या आप **आयुर्वेद मोड** में आगे बढ़ना चाहेंगे या **एलोपैथिक (अंग्रेजी दवा) मोड** में?",
            )
            options = ["Ayurveda Mode", "English Medicine (Allopathic) Mode"]
            sheet.pending_options = options
            session_store.save(sheet)
            return _response(sheet, mode_q, "mode_select", True, [], None, options)

        # Did patient open with a symptom before picking a language?
        if not _is_low_signal(patient_text):
            sheet.initial_patient_text = patient_text
            sheet.chief_complaint.evidence = patient_text
            prompt_q = (
                "Samajh gaya, main samajh sakta hoon. Pehle bataiye, which language would you like to use — "
                "English, Hindi, or Hinglish?"
            )
            options = ["English", "Hindi", "Hinglish"]
            sheet.pending_options = options
            session_store.save(sheet)
            return _response(sheet, prompt_q, "language_select", True, [], None, options)

        # Fallback repeat language question
        options = ["English", "Hindi", "Hinglish"]
        sheet.pending_options = options
        session_store.save(sheet)
        return _response(sheet, "Which language would you like to use — English, Hindi, or Hinglish?", "language_select", False, [], None, options)

    # ==========================================
    # STAGE: mode_select
    # ==========================================
    if sheet.stage == "mode_select":
        mode = _detect_mode(patient_text)
        if not mode:
            mode = "allopathic" if "english" in (patient_text or "").lower() else "ayurveda"
        sheet.mode = mode

        # If symptom was already given in turn 1
        if sheet.initial_patient_text:
            complaint_text = sheet.initial_patient_text
            sheet.chief_complaint.value = complaint_text
            sheet.collected_fields["chief_complaint"] = complaint_text
            sheet.category = _classify_category(complaint_text, mode)
            sheet.condition_key = sheet.category
            sheet.department = "Cardiology" if "cardiac" in sheet.category else ("General Medicine" if mode == "ayurveda" else "General Medicine")

            if mode == "ayurveda":
                sheet.stage = "core_intake"
                nxt = _get_next_ayurveda_question(sheet)
                if nxt and nxt.get("is_mcq"):
                    sheet.mcq_questions_asked += 1
                sheet.pending_options = nxt["options"] if nxt else []
                session_store.save(sheet)
                ack = _translate(sheet.language, english="Namaste. I have noted your concern.", hinglish="Namaste. Maine aapki takleef note kar li hai.", hindi="नमस्ते। मैंने आपकी परेशानी दर्ज कर ली है।")
                return _response(sheet, f"{ack} {nxt['text']}", nxt["slot"], True, [], None, nxt["options"])
            else:
                sheet.stage = "branching"
                nxt = _get_next_allopathic_question(sheet)
                if nxt and nxt.get("is_mcq"):
                    sheet.mcq_questions_asked += 1
                sheet.pending_options = nxt["options"] if nxt else []
                session_store.save(sheet)
                ack = _translate(sheet.language, english="Understood. Let me gather some details.", hinglish="Samajh gaya. Main kuch zaroori sawaal poochta hoon.", hindi="समझ गया। मैं कुछ जरूरी सवाल पूछ रहा हूँ।")
                return _response(sheet, f"{ack} {nxt['text']}", nxt["slot"], True, [], None, nxt["options"])

        # No symptom given yet -> ask chief complaint
        sheet.stage = "chief_complaint"
        sheet.pending_options = []
        session_store.save(sheet)
        if mode == "ayurveda":
            cc_q = _translate(
                sheet.language,
                english="Namaste. What is your main concern?",
                hinglish="Namaste. Bataiye aapko kya takleef ya samasya ho rahi hai?",
                hindi="नमस्ते। बताइए आपको क्या मुख्य समस्या या परेशानी हो रही है?",
            )
        else:
            cc_q = _translate(
                sheet.language,
                english="Please tell me what symptoms or health problem you are experiencing.",
                hinglish="Haan ji, bataiye kya problem ho rahi hai?",
                hindi="हाँ जी, बताइए आपको क्या समस्या हो रही है?",
            )
        return _response(sheet, cc_q, "chief_complaint", True, [], None, [])

    # ==========================================
    # STAGE: chief_complaint
    # ==========================================
    if sheet.stage == "chief_complaint":
        sheet.chief_complaint.value = patient_text
        sheet.chief_complaint.evidence = patient_text
        sheet.collected_fields["chief_complaint"] = patient_text
        sheet.category = _classify_category(patient_text, sheet.mode)
        sheet.condition_key = sheet.category
        sheet.department = "Cardiology" if "cardiac" in sheet.category else "General Medicine"

        if sheet.mode == "ayurveda":
            sheet.stage = "core_intake"
            nxt = _get_next_ayurveda_question(sheet)
            if nxt and nxt.get("is_mcq"):
                sheet.mcq_questions_asked += 1
            sheet.pending_options = nxt["options"] if nxt else []
            session_store.save(sheet)
            next_q = f"{_acknowledge(sheet)} {nxt['text']}" if nxt else "Thank you."
            return _response(sheet, next_q, nxt["slot"] if nxt else None, True, [], None, nxt["options"] if nxt else [])
        else:
            sheet.stage = "branching"
            nxt = _get_next_allopathic_question(sheet)
            if nxt and nxt.get("is_mcq"):
                sheet.mcq_questions_asked += 1
            sheet.pending_options = nxt["options"] if nxt else []
            session_store.save(sheet)
            next_q = f"{_acknowledge(sheet)} {nxt['text']}" if nxt else "Thank you."
            return _response(sheet, next_q, nxt["slot"] if nxt else None, True, [], None, nxt["options"] if nxt else [])

    # ==========================================
    # STAGE: core_intake (Ayurveda Dynamic Core)
    # ==========================================
    if sheet.stage == "core_intake":
        _set_slot(sheet, asked_slot, {"value": patient_text, "evidence": patient_text}, turn_index)
        nxt = _get_next_ayurveda_question(sheet)

        if nxt:
            if nxt.get("is_mcq"):
                sheet.mcq_questions_asked += 1
            sheet.pending_options = nxt.get("options") or []
            if nxt.get("phase") == "branch":
                sheet.stage = "branching"
            session_store.save(sheet)
            return _response(sheet, f"{_acknowledge(sheet)} {nxt['text']}", nxt["slot"], True, [], None, nxt.get("options"))
        else:
            return _close_session(sheet)

    # ==========================================
    # STAGE: branching (Allopathic & Ayurveda)
    # ==========================================
    if sheet.stage == "branching":
        # Extract and record slot
        if not _is_low_signal(patient_text):
            candidate_slots = _all_slots(sheet)
            patches = extraction.extract(asked_slot, patient_text, candidate_slots=candidate_slots)
            _apply_patches(sheet, patches, turn_index, primary_slot=asked_slot)
        else:
            _set_slot(sheet, asked_slot, {"value": patient_text, "evidence": patient_text}, turn_index)

        new_flags = _apply_red_flags(sheet)

        # In legacy mode where condition_key has JSON tree
        if sheet.tree_source == "predefined" and question_tree.has_tree(sheet.condition_key):
            tree = question_tree.load_tree(sheet.condition_key)
            nxt_legacy = question_tree.next_question(sheet, tree)
            if nxt_legacy:
                session_store.save(sheet)
                return _response(sheet, f"{_acknowledge(sheet)} {nxt_legacy['question']}", nxt_legacy["slot"], True, new_flags, None, [])
            return _close_session(sheet)

        if sheet.mode == "ayurveda":
            nxt = _get_next_ayurveda_question(sheet)
        else:
            nxt = _get_next_allopathic_question(sheet)

        if nxt:
            if nxt.get("is_mcq"):
                sheet.mcq_questions_asked += 1
            sheet.pending_options = nxt.get("options") or []
            session_store.save(sheet)
            combined_prefix = med_rule_prefix + report_rule_prefix
            next_q = f"{combined_prefix}{_acknowledge(sheet)} {nxt['text']}"
            return _response(sheet, next_q, nxt["slot"], True, new_flags, None, nxt.get("options"))
        else:
            return _close_session(sheet)

    # Fallback to closing
    return _close_session(sheet)


def _flatten(node: Any) -> Any:
    if isinstance(node, dict):
        if node.keys() >= {"value", "evidence", "turn_index"}:
            return node.get("value")
        return {k: _flatten(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_flatten(v) for v in node]
    return node


def get_final_case_sheet(session_id: str) -> Dict[str, Any]:
    sheet = session_store.load(session_id)
    if sheet is None:
        raise ValueError(f"Session {session_id} expired or not found")
    if not sheet.is_complete:
        raise RuntimeError(f"Session {session_id} is not complete yet")

    return _flatten(sheet.model_dump())
