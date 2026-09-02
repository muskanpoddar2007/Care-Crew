"""
=====================================================================
  VOICE -> TEXT (ASR)  |  Owner: Khushi
=====================================================================

Kaam: Hindi/Hinglish AUDIO ko TEXT me convert karna, Sarvam AI se.
Jaise koi patient bol ke bole "seene me dard ho raha hai" -> hume
text "seene me dard ho raha hai" chahiye.

Ye file me poora skeleton diya hai + comments me har step samjhaaya hai.
Tumhe sirf 2-3 jagah code likhna hai (neeche "TODO" likha hai).

---------------------------------------------------------------------
 PEHLE YE 4 STEP (code se pehle):
---------------------------------------------------------------------
 1. sarvam.ai pe jao -> Sign up -> free account ban jayega
 2. Dashboard me "API Keys" -> ek key banao -> copy karo
 3. Project ke backend/.env file me ye line daalo (apni key paste karo):
        SARVAM_API_KEY=yahan_apni_key_paste_karo
 4. Terminal me Sarvam ka SDK install karo:
        pip install sarvamai

---------------------------------------------------------------------
 CHALA KE TEST KAISE KARNA:
---------------------------------------------------------------------
 - Ek chhoti Hindi audio record karo (phone se .wav ya .mp3, 10-15 sec)
 - Us file ko voice/ folder me rakho, naam maano test.wav
 - Terminal me:   python voice/transcribe.py test.wav
 - Agar text print hua -> ho gaya!
=====================================================================
"""

import os
import sys


def transcribe(audio_file: str) -> str:
    """
    audio_file: audio ka path (jaise "test.wav")
    return: us audio ka Hindi/Hinglish text

    Neeche 3 hisse hain. STEP 2 wale hisse me hi tumhe likhna hai,
    baaki maine bhar diya hai taaki structure samajh aaye.
    """

    # ---------- STEP 1: API key uthao (ye ho chuka hai) ----------
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise RuntimeError(
            "SARVAM_API_KEY nahi mili. backend/.env me daali hai? "
            "Line honi chahiye: SARVAM_API_KEY=xxxx"
        )

    # ---------- STEP 2: Sarvam ko audio bhej ke text lao ----------
    #
    # Sarvam ka SDK use kar rahe hain. Docs: https://docs.sarvam.ai
    # (Speech-to-Text section dekhna. Model: saaras:v3, language: hi-IN)
    #
    # SDK ka pattern aisa hota hai (docs se confirm kar lena, versions
    # ke saath thoda change ho sakta hai):
    #
    #     from sarvamai import SarvamAI
    #     client = SarvamAI(api_subscription_key=api_key)
    #     with open(audio_file, "rb") as f:
    #         response = client.speech_to_text.transcribe(
    #             file=f,
    #             model="saaras:v3",
    #             language_code="hi-IN",
    #         )
    #     text = response.transcript
    #
    # TODO (Khushi): upar wale pattern ko yahan uncomment/likho,
    # aur 'text' variable me final transcript daalo.

    text = None  # <- isko upar wale response se replace karo

    # -------------------------------------------------------------

    # ---------- STEP 3: text return karo (ho chuka) ----------
    if not text:
        raise NotImplementedError(
            "STEP 2 abhi baaki hai - Sarvam call likhna hai. "
            "docs.sarvam.ai ka Speech-to-Text quickstart dekho."
        )
    return text


# ---- ise chhedne ki zaroorat nahi, ye test ke liye hai ----
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kaise chalayein:  python voice/transcribe.py <audio_file>")
        print("Udaharan:         python voice/transcribe.py test.wav")
        sys.exit(1)

    result = transcribe(sys.argv[1])
    print("\n--- Transcript ---")
    print(result)
