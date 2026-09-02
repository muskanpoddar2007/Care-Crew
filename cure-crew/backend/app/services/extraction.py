"""
Extraction — patient ke jawab se structured data (value + evidence) nikaalta hai.

Ye pura system ki JAAN hai. Gemini patient ke natural Hinglish jawab ko dekh ke
{"value": <saaf value>, "evidence": <patient ka exact bola hua>} return karta hai.

- GEMINI_API_KEY set hai  -> real Gemini call
- key nahi hai            -> stub (raw text daal deta hai, taaki team bina key ke chale)

Anurag: key .env me daal ke  `python -m app.services.extraction`  chala ke test kar sakta hai.
"""
import json
import re
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
}

_PROMPT = """Tum ek medical history extraction assistant ho. Tumhara kaam patient ke jawab se
ek structured field nikaalna hai. Tum diagnosis ya salah NAHI dete — sirf jo patient ne kaha
wahi structure karte ho.

Field jo nikaalni hai: {slot}
Is field ka matlab: {hint}

Patient ne kaha: "{answer}"

Rules:
- SIRF ek JSON object return karo. Koi markdown, koi ```, koi extra text nahi.
- Format bilkul ye: {{"value": "<saaf, chhoti value>", "evidence": "<patient ke shabd jinse ye pata chala>"}}
- "value" saaf aur normalized ho (jaise "3 din", "7/10", "baayein haath me").
- "evidence" patient ke ASLI shabd ho (jitna relevant part utna hi).
- Agar patient ke jawab me is field se related kuch NAHI hai, to: {{"value": null, "evidence": null}}
- Kuch bhi apni taraf se mat jodo. Jo nahi kaha, wo mat likho.

JSON:"""


def _stub(slot: str, answer: str) -> dict:
    a = (answer or "").strip()
    return {"value": a or None, "evidence": a or None}


def _parse_json(text: str) -> dict:
    """Gemini kabhi-kabhi ``` ya extra text de deta hai — usme se JSON nikaalo."""
    text = text.strip()
    # code fences hatao
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # pehla { ... } block pakdo
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    return json.loads(text)


def extract(slot: str, answer: str) -> dict:
    """
    Patient ke jawab se {value, evidence} nikaalo.
    Fail hone pe stub pe gir jao — demo kabhi na ruke.
    """
    if not settings.GEMINI_API_KEY:
        return _stub(slot, answer)

    if not (answer or "").strip():
        return {"value": None, "evidence": None}

    hint = _SLOT_HINTS.get(slot, "Patient ke jawab se relevant value nikaalo.")
    prompt = _PROMPT.format(slot=slot, hint=hint, answer=answer.strip())

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            "gemini-3.6-flash",
            generation_config={"temperature": 0, "response_mime_type": "application/json"},
        )
        resp = model.generate_content(prompt)
        data = _parse_json(resp.text)
        value = data.get("value")
        evidence = data.get("evidence")
        # agar model ne value di par evidence nahi, to patient ka raw text hi evidence
        if value and not evidence:
            evidence = answer.strip()
        return {"value": value, "evidence": evidence}
    except Exception as e:
        print(f"[extraction] fallback to stub ({slot}): {e}")
        return _stub(slot, answer)


# ---- quick test: python -m app.services.extraction ----
if __name__ == "__main__":
    tests = [
        ("chief_complaint", "doctor sahab subah se seene me bahut dard ho raha hai"),
        ("hopi.location", "seene ke beech me, thoda left side"),
        ("hopi.severity", "bahut tez tha, so nahi paya, 8-9 hoga"),
        ("hopi.radiation", "haan baayein haath me bhi ja raha hai"),
        ("review_of_systems.sweating", "haan bahut pasina aa raha tha"),
        ("hopi.onset", "achanak nashte ke baad shuru hua"),
        ("past_history", "sugar hai, aur BP ki dawai chalti hai"),
        ("hopi.duration", "koi bees pachees minute"),
    ]
    print(f"GEMINI key set: {bool(settings.GEMINI_API_KEY)}\n")
    for slot, ans in tests:
        out = extract(slot, ans)
        print(f"[{slot}]")
        print(f"   in : {ans}")
        print(f"   out: value={out['value']!r}  evidence={out['evidence']!r}\n")