# Care Crew — SIH 2026

**Patient Case-Taking Agent** — ek conversational system jo doctor-patient baatcheet se ek
verifiable clinical **case sheet** banata hai. Ye "chatbot" nahi hai — ye ek structured
history-taking agent hai jo har field ke saath transcript ka evidence link deta hai, aur
red-flag symptoms turant flag karta hai.

> ⚠️ Ye system kabhi diagnosis ya dawai suggest nahi karta. Sirf history collect karta hai.

---

## Team & Ownership

| Area | Owner | Folder |
|------|-------|--------|
| Core AI pipeline (schema, slot-filling, extraction, red-flags) | Anurag | `/ml` + `/backend/app` |
| Infra (FastAPI, WebSocket, Redis, Postgres, deploy) | Muskan | `/backend` |
| Voice + test data (ASR, transcripts) | Khushi | `/voice` |
| Frontend (chat UI + doctor dashboard) | FE team | `/frontend` |

**Rule: har koi apni folder me kaam karega.** Isse merge conflict lagbhag zero rahega.

---

## Repo Structure

```
cure-crew-sih2026/
├── backend/          # FastAPI app — API + infra (Muskan)
│   ├── app/
│   │   ├── core/         # config, redis, db connections
│   │   ├── models/       # Pydantic CaseSheet schema (SOURCE OF TRUTH)
│   │   ├── services/     # session, extraction, red-flag logic
│   │   ├── api/          # routes + websocket
│   │   ├── data/         # question trees (JSON)
│   │   └── main.py
│   └── requirements.txt
├── ml/               # extraction prompts, question-tree logic (Anurag)
├── voice/            # ASR pipeline + patient transcripts (Khushi)
├── frontend/         # chat UI + doctor dashboard (FE team)
├── docs/             # schema doc, PPT, notes
└── README.md
```

---

## Setup (sabke liye — ek baar)

```bash
# 1. Clone
git clone https://github.com/cure-crew/cure-crew-sih2026.git
cd cure-crew-sih2026/backend

# 2. Virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install
pip install -r requirements.txt

# 4. Env file banao (.env.example se copy karo, apni keys daalo)
cp .env.example .env

# 5. Run
uvicorn app.main:app --reload
# open http://localhost:8000/docs
```

---

## Git Workflow (IMPORTANT — sab padho)

**`main` pe kabhi direct kaam mat karna.** Har feature apni branch pe.

```bash
# har naye kaam se pehle:
git checkout main
git pull                                  # latest le lo
git checkout -b feat/apna-part-ka-naam    # nayi branch

# kaam karne ke baad:
git add .
git commit -m "feat: kya kiya"
git push -u origin feat/apna-part-ka-naam

# fir GitHub pe jaake Pull Request banao → ek review → merge
```

**Branch naam convention:**
- `feat/redis-session`, `feat/slot-filling`, `feat/asr-pipeline` (naya feature)
- `fix/extraction-bug` (bug fix)
- `docs/schema-update` (sirf docs)

**Commit message convention:** `feat:` `fix:` `chore:` `docs:` se shuru karo.

### Kabhi mat karna
- ❌ `git push --force` — chahe internet pe kuch bhi likha ho
- ❌ `main` branch pe direct commit
- ❌ `.env` file commit (API keys leak ho jayengi — .gitignore isko rok raha hai)

Kuch toot jaye to khud fix karne me 15 min se zyada mat lagao — group me screenshot daalo.

---

## Daily Sync
- **Subah 15 min:** aaj kaun kya karega
- **Raat 15 min:** kya hua, kya atka

---

## Tech Stack
FastAPI · WebSocket · Redis (session state) · PostgreSQL (final case sheets) ·
Google Gemini (extraction) · Groq/Llama (phrasing) · Sarvam/Bhashini (Hindi ASR) · ReportLab (PDF)
