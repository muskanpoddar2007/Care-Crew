"""
Cure Crew — FastAPI entrypoint.

Run:  uvicorn app.main:app --reload
Docs: http://localhost:8000/docs
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core import session_store
from app.core.responses import AppError
from app.api.routes import router
from app.api.auth_routes import router as auth_router

app = FastAPI(title=settings.APP_NAME)

# Frontend ko allow karo (dev me sab allow, prod me specific domain daalna)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    """Prescription module errors carry their {success, message, error} body
    directly — not nested under FastAPI's default {"detail": ...} key."""
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


app.include_router(router)
app.include_router(auth_router)


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
