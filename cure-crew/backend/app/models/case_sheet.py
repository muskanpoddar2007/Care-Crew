"""
Case Sheet schema — SOURCE OF TRUTH for the whole project.

Sab kuch is schema ke around bana hai. Agar ye change karna ho, pehle team ko batao —
frontend aur extraction dono ispe depend karte hain.

Har extracted field ek `Field` object hai jisme value + evidence (patient ka exact bola hua)
hota hai. Evidence linking hi hamara sabse bada differentiator hai.
"""
from __future__ import annotations
from pydantic import BaseModel, Field as PydField
from typing import Optional


class Evidence(BaseModel):
    """Ek extracted field: value + patient ne exactly kya kaha."""
    value: Optional[str] = None
    evidence: Optional[str] = None          # patient ka verbatim snippet
    turn_index: Optional[int] = None        # kis turn me aaya (highlight ke liye)


class HOPI(BaseModel):
    """History of Presenting Illness — OLDCARTS framework."""
    onset: Evidence = PydField(default_factory=Evidence)          # kab shuru hua
    location: Evidence = PydField(default_factory=Evidence)       # kahan
    duration: Evidence = PydField(default_factory=Evidence)       # kitni der se
    character: Evidence = PydField(default_factory=Evidence)      # kaisa dard (jalan/chubhan)
    aggravating: Evidence = PydField(default_factory=Evidence)    # kis se badhta hai
    relieving: Evidence = PydField(default_factory=Evidence)      # kis se aaram
    radiation: Evidence = PydField(default_factory=Evidence)      # kahin aur failta hai?
    timing: Evidence = PydField(default_factory=Evidence)         # continuous/intermittent
    severity: Evidence = PydField(default_factory=Evidence)       # 1-10


class PersonalHx(BaseModel):
    diet: Evidence = PydField(default_factory=Evidence)
    sleep: Evidence = PydField(default_factory=Evidence)
    tobacco: Evidence = PydField(default_factory=Evidence)
    alcohol: Evidence = PydField(default_factory=Evidence)


class CaseSheet(BaseModel):
    session_id: str
    patient_name: Optional[str] = None
    age: Optional[str] = None
    sex: Optional[str] = None

    chief_complaint: Evidence = PydField(default_factory=Evidence)
    hopi: HOPI = PydField(default_factory=HOPI)
    past_history: list[str] = PydField(default_factory=list)
    drug_history: list[str] = PydField(default_factory=list)
    allergies: list[str] = PydField(default_factory=list)
    family_history: list[str] = PydField(default_factory=list)
    personal_history: PersonalHx = PydField(default_factory=PersonalHx)
    review_of_systems: dict = PydField(default_factory=dict)

    red_flags: list[str] = PydField(default_factory=list)
    is_urgent: bool = False
    is_complete: bool = False

    def missing_hopi_slots(self) -> list[str]:
        """Kaunse HOPI slots abhi khaali hain — slot-filling loop isko use karta hai."""
        return [name for name, ev in self.hopi.model_dump().items()
                if ev.get("value") in (None, "")]
