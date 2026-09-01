"""
Cure Crew — FastAPI entrypoint.

Run:  uvicorn app.main:app --reload
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core import session_store
from app.api.routes import router

app = FastAPI(title=settings.APP_NAME)

# Frontend ko allow karo (dev me sab allow, prod me specific domain daalna)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "ok",
        "session_backend": session_store.backend_name(),
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
