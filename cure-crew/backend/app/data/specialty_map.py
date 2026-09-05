"""Maps a case sheet's condition_key (the intent picked during case-taking —
see CaseSheet.condition_key) to the doctor specialization it should route to.
Used by app/services/doctor_directory.recommend_for_complaint().

Fallback for anything unmapped (or no complaint at all): General Physician.
"""
from typing import Optional

DEFAULT_SPECIALTY = "General Physician"

COMPLAINT_TO_SPECIALTY: dict[str, str] = {
    "chest_pain": "Cardiologist",
    "breathing_difficulty": "Pulmonologist",
    "stomach_pain": "Gastroenterologist",
    "headache": "Neurologist",
    "fever": DEFAULT_SPECIALTY,
    "cough_cold": DEFAULT_SPECIALTY,
    "body_pain": DEFAULT_SPECIALTY,
}


def specialty_for_complaint(condition_key: Optional[str]) -> str:
    if not condition_key:
        return DEFAULT_SPECIALTY
    return COMPLAINT_TO_SPECIALTY.get(condition_key.strip().lower(), DEFAULT_SPECIALTY)
