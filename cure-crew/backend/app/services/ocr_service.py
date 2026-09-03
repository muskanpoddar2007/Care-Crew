"""
OCR — prescription image/PDF se structured data (doctor, medicines, instructions)
nikaalta hai.

Abhi dummy hai — extraction.py ke stub pattern jaisa hi: demo kabhi na ruke, bas
structure ready rahe taaki real OCR/vision model baad me isi function signature
pe plug ho jaaye.
"""
from typing import Any, Optional


def extract_prescription_data(filename: str, content_type: Optional[str] = None) -> dict[str, Any]:
    """
    Dummy OCR extraction. Real OCR isi return-shape ko keep karke yahan plug hoga:
    doctor_name, doctor_specialization, prescription_date, medicines[],
    doctor_instructions, precautions.
    """
    return {
        "doctor_name": None,
        "doctor_specialization": None,
        "prescription_date": None,
        "medicines": [],
        "doctor_instructions": None,
        "precautions": None,
    }
