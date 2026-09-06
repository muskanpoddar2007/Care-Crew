"""
Sarvam AI speech-to-text — used ONLY by the floating bot widget's mic button.

Replaces the browser's built-in SpeechRecognition (English-centric, patchy
Hindi support, Chrome-only) with Sarvam's speech-to-text, which is built for
Indian languages and code-mixed Hindi/Hinglish/English speech — matching how
patients actually talk in this app. `language_code="unknown"` lets Sarvam
auto-detect rather than guessing from the UI's reply-language selector.

Never touches case-taking state — this only turns audio into text, exactly
as if the patient had typed it themselves.
"""
import requests

from app.core.config import settings

_STT_URL = "https://api.sarvam.ai/speech-to-text"
_STT_MODEL = "saaras:v3"  # "saarika:v2" was deprecated server-side — verified live against the real API


class VoiceTranscriptionError(Exception):
    """User-safe message — never leaks raw API/network internals to the client."""


def transcribe(audio_bytes: bytes, filename: str, content_type: str) -> dict:
    """Returns {"transcript": str, "language_code": str | None}."""
    if not settings.SARVAM_API_KEY:
        raise VoiceTranscriptionError("Voice input isn't configured on this server.")

    if not audio_bytes:
        raise VoiceTranscriptionError("No audio received.")

    try:
        resp = requests.post(
            _STT_URL,
            headers={"api-subscription-key": settings.SARVAM_API_KEY},
            files={"file": (filename or "recording.webm", audio_bytes, content_type or "audio/webm")},
            data={"model": _STT_MODEL, "language_code": "unknown"},
            timeout=25,
        )
    except requests.RequestException as e:
        raise VoiceTranscriptionError("Could not reach the voice transcription service.") from e

    if resp.status_code != 200:
        print(f"[voice_service] Sarvam STT {resp.status_code}: {resp.text[:300]}")
        raise VoiceTranscriptionError("Voice transcription failed — please try again or type instead.")

    try:
        data = resp.json()
    except ValueError as e:
        raise VoiceTranscriptionError("Voice transcription failed — please try again or type instead.") from e

    return {
        "transcript": (data.get("transcript") or "").strip(),
        "language_code": data.get("language_code"),
    }
