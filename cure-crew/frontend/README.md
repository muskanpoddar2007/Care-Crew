# /frontend — Chat UI + Doctor Dashboard (FE team)

## API endpoints (backend se)
- `POST /api/session/start`  -> { session_id, next_question, next_slot }
- `POST /api/session/turn`   -> { next_question, next_slot, is_urgent, new_red_flags, state }
- `GET  /api/session/{id}/casesheet` -> pura case sheet

## Do screens
1. **Chat UI** — patient conversation, urgent red-flag banner (is_urgent true pe laal banner)
2. **Doctor dashboard** — case sheet, har field ke saath evidence snippet (turn_index se
   highlight), edit + confirm, PDF download

Backend ready hone ka wait mat karo — upar wale response shape pe mock JSON bana ke UI shuru
kar do.
