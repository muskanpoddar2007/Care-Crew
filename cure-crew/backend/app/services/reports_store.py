"""
Persistent store for COMPLETED case sheets — survives past session_store's TTL
(SESSION_TTL_SECONDS), so a patient's history stays visible in the Reports tab
after the live session expires. Reuses the same generic KeyValueStore db.py
already provides for User; shared between conversation.py (writes on
completion) and api/patient_routes.py (reads) to avoid the services layer
depending on the api layer.
"""
from app.core.db import KeyValueStore
from app.models.case_sheet import CaseSheet

case_report_store = KeyValueStore("case_report", CaseSheet)
