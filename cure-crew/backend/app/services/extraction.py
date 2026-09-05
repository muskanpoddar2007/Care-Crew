"""
Extraction — patient ke EK jawab se structured data (value + evidence) nikaalta hai,
MULTIPLE slots ke liye ek saath (sirf jo slot poocha gaya tha wahi nahi) — e.g.
"duration" poochne pe patient khud hi radiation aur sweating bhi bata de to teeno
ek hi call me bhar jaate hain. question_tree.next_question() phir un bhare hue
slots ko khud-ba-khud skip kar deta hai, kyunki wo already-filled check karta hai.

Ye pura system ki JAAN hai. Model patient ke natural Hinglish jawab ko dekh ke
{"<slot>": {"value": <saaf value>, "evidence": <patient ka exact bola hua>}, ...}
return karta hai — sirf un slots ke liye jinke baare me patient ne kuch bataya.

Backend priority (koi na koi hamesha chalta hai — demo kabhi na ruke):
1. GROQ_API_KEY set hai   -> Groq (PRIMARY — fast, live demo ke liye best)
2. Groq fail/missing      -> GEMINI_API_KEY set hai to Gemini pe fallback
3. dono fail/missing      -> stub (asked_slot me raw text daal deta hai, baaki khaali)

Koi diagnosis/treatment kabhi nahi nikaalta — sirf jo patient ne khud kaha wahi
structure hota hai, aur sirf un slots ke liye jo explicitly candidate list me diye gaye.

Anurag: keys .env me daal ke `python -m app.services.extraction` chala ke test kar sakta hai.
"""
import json
import re
from typing import Optional

from app.core.config import settings

# Har slot ke liye chhota context — isse Gemini ko pata rehta hai kya nikaalna hai.
_SLOT_HINTS = {
    "chief_complaint": "Patient ki mukhya taklif ek line me (jaise 'seene me dard').",
    "hopi.onset": "Dard/taklif KAB shuru hui (achanak ya dheere-dheere, kitne time pehle).",
    "hopi.location": "Taklif SHAREER me KAHAN hai (jaise 'seene ke beech', 'left side').",
    "hopi.duration": "Ek episode KITNI DER rehta hai (minute/ghante/din).",
    "hopi.character": "Dard KAISA hai (jalan, dabaav, chubhan, bhaari).",
    "hopi.aggravating": "Kis cheez se taklif BADHTI hai (chalna, saans, khaana).",
    "hopi.relieving": "Kis cheez se ARAAM milta hai (rest, dawai).",
    "hopi.radiation": "Dard KAHIN AUR failta hai? (baayan haath, jabda, peeth).",
    "hopi.timing": "Continuous hai ya aata-jaata (intermittent).",
    "hopi.severity": "Teevrता 1-10 scale pe (agar patient number na de to andaaza mat lagao).",
    "review_of_systems.sweating": "Pasina aa raha hai? haan/nahi.",
    "review_of_systems.breathlessness": "Saans lene me takleef? haan/nahi.",
    "review_of_systems.nausea": "Matli/ulti jaisa? haan/nahi.",
    "past_history": "Purani bimariyan (BP, sugar, heart, etc).",
    "drug_history": "Abhi chal rahi dawaiyan.",
    "family_history": "Ghar me kisi ko heart/aisi bimari.",
    "personal_history.tobacco": "Tambaku/cigarette lete hain? haan/nahi.",

    # Fever
    "review_of_systems.chills": "Thand lagna/kaanpna (shivering)? haan/nahi.",
    "review_of_systems.body_ache": "Badan dard/kamzori? haan/nahi.",
    "review_of_systems.rash": "Shareer par rash/laal daane? haan/nahi.",
    "review_of_systems.recent_travel": "Pichle 2 hafton me bahar travel kiya? haan/nahi, kahan.",

    # Cough/cold
    "review_of_systems.phlegm_color": "Balgam ka rang (saaf/peela/hara).",
    "review_of_systems.sore_throat": "Gale me kharaash/dard? haan/nahi.",
    "review_of_systems.fever_with_it": "Iske saath bukhaar? haan/nahi.",
    "review_of_systems.chest_pain_with_cough": "Khaansi ke saath seene me dard? haan/nahi.",
    "review_of_systems.blood_in_cough": "Khaansi me khoon? haan/nahi.",

    # Stomach pain
    "review_of_systems.related_to_food": "Khaana khaane se pehle/baad me dard badhta hai.",
    "review_of_systems.recent_food": "Aajkal kuch bahar ka/alag khaya tha.",
    "review_of_systems.vomiting": "Ulti ho rahi hai? haan/nahi.",
    "review_of_systems.loose_motion": "Loose motion/dast? haan/nahi.",
    "review_of_systems.blood_in_stool": "Motion me khoon? haan/nahi.",
    "review_of_systems.blood_in_vomit": "Ulti me khoon? haan/nahi.",

    # Headache
    "review_of_systems.vision_changes": "Dikhne me dikkat/dhundhla? haan/nahi.",
    "review_of_systems.worst_headache_ever": "Zindagi ka sabse tez sar dard, achanak? haan/nahi.",
    "review_of_systems.neck_stiffness": "Gardan akadna? haan/nahi.",

    # Body pain
    "review_of_systems.weakness": "Kamzori/chalne-firne me dikkat? haan/nahi.",
    "review_of_systems.swelling": "Kisi jagah sujan (swelling)? haan/nahi.",

    # Breathing difficulty
    "review_of_systems.breathless_at_rest": "Aaram karte waqt bhi saans phoolna? haan/nahi.",
    "review_of_systems.chest_pain_with_breathing": "Saans ke saath seene me dard? haan/nahi.",
    "review_of_systems.lips_bluish": "Honth/ungliyaan neeli/pili padna? haan/nahi.",
    "review_of_systems.wheezing": "Seeti jaisi awaaz (wheezing)? haan/nahi.",
    "review_of_systems.cough": "Iske saath khaansi? haan/nahi.",
}

_MULTI_PROMPT = """Tum ek medical history extraction assistant ho. Patient ke EK jawab me
kabhi-kabhi ek se zyada cheezon ki information hoti hai — tumhara kaam un SABKO nikaalna
hai, sirf ek tak mat ruko. Tum diagnosis ya salah NAHI dete — sirf jo patient ne khud kaha
wahi structure karte ho.

Patient ne kaha: "{answer}"

Neeche diye gaye fields me se, JIN JIN ke baare me patient ne is jawab me kuch bataya hai,
sirf unhi ko bharo:
{fields_block}

Rules:
- SIRF ek JSON object return karo. Koi markdown, koi ```, koi extra text nahi.
- Format bilkul ye: {{"<field_name>": {{"value": "<saaf, chhoti value>", "evidence": "<patient ke asli shabd>"}}, ...}}
- Field name EXACTLY wahi likho jo upar diya gaya hai — naya field kabhi mat banao.
- Jis field ke baare me patient ne KUCH nahi bataya, use output me include hi mat karo.
- "value" saaf aur normalized ho (jaise "3 din", "7/10", "baayein haath me").
- "evidence" patient ke ASLI shabd ho (jitna relevant part utna hi).
- Kuch bhi apni taraf se mat jodo, diagnosis/dawai ki salah mat do — jo bola gaya sirf wahi.
- Agar KISI bhi field ke baare me kuch nahi mila, to khaali JSON object do: {{}}

JSON:"""


def _fields_block(slots: list[str]) -> str:
    return "\n".join(f'- "{s}": {_SLOT_HINTS.get(s, "Patient ke jawab se relevant value.")}' for s in slots)


def _stub(slot: str, answer: str) -> dict:
    a = (answer or "").strip()
    return {"value": a or None, "evidence": a or None}


def _parse_json(text: str) -> dict:
    """Model kabhi-kabhi ``` ya extra text de deta hai — usme se JSON nikaalo."""
    text = (text or "").strip()
    # code fences hatao
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # pehla { ... } block pakdo
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
        temperature=0,
        response_format={"type": "json_object"},
    )
    return resp.choices[0].message.content


def _call_gemini(prompt: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        "gemini-3.6-flash",
        generation_config={"temperature": 0, "response_mime_type": "application/json"},
    )
    resp = model.generate_content(prompt)
    return resp.text


def extract(asked_slot: str, answer: str, candidate_slots: Optional[list[str]] = None) -> dict:
    """
    Ek patient turn se {slot: {value, evidence}} nikaalta hai — sirf `asked_slot`
    ke liye nahi, `candidate_slots` (baaki abhi-tak-khaali slots) me se bhi jo
    kuch patient ne isi jawab me khud bata diya ho (e.g. duration poochne par
    radiation + sweating bhi bata dena). `asked_slot` hamesha result me hota hai
    (kuch na mile to {{"value": None, "evidence": None}}); baaki slots sirf tabhi
    aate hain jab unke baare me kuch mila ho.

    Backend priority: Groq (PRIMARY) -> Gemini (fallback) -> stub (asked_slot
    me raw text, baaki khaali) — koi na koi hamesha chalta hai, demo kabhi na ruke.
    """
    answer = (answer or "").strip()
    slots = list(dict.fromkeys([asked_slot, *(candidate_slots or [])]))  # asked_slot first, de-duped

    if not answer:
        return {asked_slot: {"value": None, "evidence": None}}

    prompt = _MULTI_PROMPT.format(answer=answer, fields_block=_fields_block(slots))

    raw = None
    if settings.GROQ_API_KEY:
        try:
            raw = _call_groq(prompt)
        except Exception as e:
            print(f"[extraction] Groq failed, falling back: {e}")

    if raw is None and settings.GEMINI_API_KEY:
        try:
            raw = _call_gemini(prompt)
        except Exception as e:
            print(f"[extraction] Gemini fallback failed: {e}")

    if raw is None:
        return {asked_slot: _stub(asked_slot, answer)}

    try:
        data = _parse_json(raw)
    except Exception as e:
        print(f"[extraction] JSON parse failed, stub fallback: {e}")
        return {asked_slot: _stub(asked_slot, answer)}

    results: dict = {}
    for slot in slots:
        entry = data.get(slot)
        if not isinstance(entry, dict):
            continue
        value = entry.get("value")
        if value in (None, ""):
            continue
        evidence = entry.get("evidence")
        # agar model ne value di par evidence nahi, to patient ka raw text hi evidence
        if not evidence:
            evidence = answer
        results[slot] = {"value": value, "evidence": evidence}

    # asked_slot ka contract explicit rakho — na mile to bhi null ke saath present ho
    results.setdefault(asked_slot, {"value": None, "evidence": None})

    return results


# ---- quick test: python -m app.services.extraction ----
if __name__ == "__main__":
    print(f"GROQ key set:   {bool(settings.GROQ_API_KEY)}")
    print(f"GEMINI key set: {bool(settings.GEMINI_API_KEY)}\n")

    # Single-slot sanity checks (candidate_slots omitted -> asked_slot only)
    single_tests = [
        ("chief_complaint", "doctor sahab subah se seene me bahut dard ho raha hai"),
        ("hopi.location", "seene ke beech me, thoda left side"),
        ("hopi.severity", "bahut tez tha, so nahi paya, 8-9 hoga"),
        ("hopi.onset", "achanak nashte ke baad shuru hua"),
        ("past_history", "sugar hai, aur BP ki dawai chalti hai"),
    ]
    print("=== single-slot ===")
    for slot, ans in single_tests:
        out = extract(slot, ans)
        print(f"[{slot}]  in: {ans!r}")
        print(f"   out: {out}\n")

    # Rich turn — chest_pain tree ke teen slots ek saath (duration poocha,
    # patient ne radiation + sweating bhi khud bata diya).
    print("=== multi-slot: rich chest_pain turn (asked=hopi.duration) ===")
    rich_answer = "koi bees pachees minute rehta hai, aur baayein haath me bhi failta hai, saath me bahut pasina aata hai"
    candidates = ["hopi.radiation", "review_of_systems.sweating", "hopi.aggravating"]
    out = extract("hopi.duration", rich_answer, candidate_slots=candidates)
    print(f"in: {rich_answer!r}")
    print(f"candidate_slots: {['hopi.duration', *candidates]}")
    print(f"out ({len(out)} slots filled): {out}")