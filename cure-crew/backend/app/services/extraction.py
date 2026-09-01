"""
Extraction — patient ke jawab se JSON patch nikaalta hai (value + evidence).

Gemini use karta hai. Agar GEMINI_API_KEY set nahi hai, ek stub chalta hai jo raw text ko
current slot me daal deta hai — isse baaki team bina API key ke bhi pipeline test kar sakti
hai. Real prompt tuning /ml folder me hogi.

Anurag: asli kaam yahi hai. Prompt me strict JSON aur evidence enforce karna. Output STRICT
JSON hona chahiye, koi markdown/backtick nahi.
"""
import json
from app.core.config import settings

_PROMPT = """Tum ek medical history extractor ho. Patient ke jawab se sirf JSON nikalo.

Poocha gaya slot: {slot}
Patient ka jawab: "{answer}"

Rules:
- Sirf ek JSON object return karo, aur kuch nahi (no markdown, no backticks).
- Format: {{"value": "<saaf value>", "evidence": "<patient ka exact bola hua relevant hissa>"}}
- Agar jawab me kuch relevant nahi hai to value null rakho.
"""


def _stub(slot: str, answer: str) -> dict:
    return {"value": answer.strip() or None, "evidence": answer.strip() or None}


def extract(slot: str, answer: str) -> dict:
    """Return {"value":..., "evidence":...} for the given slot."""
    if not settings.GEMINI_API_KEY:
        return _stub(slot, answer)

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(_PROMPT.format(slot=slot, answer=answer))
        text = resp.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(text)
        return {"value": data.get("value"), "evidence": data.get("evidence") or answer.strip()}
    except Exception:
        # kabhi bhi extraction fail ho to demo na ruke — stub pe gir jao
        return _stub(slot, answer)
