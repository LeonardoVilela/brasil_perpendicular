from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.feedback_store import append_feedback
from app.models import ContextPayload, DeepPayload, FeedbackPayload, FramesPayload

API_VERSION = "0.1.0"
MAX_BODY_BYTES = 5_242_880
UNAVAILABLE_DETAIL = "Análise profunda ainda não implementada nesta versão."

app = FastAPI(title="Brasil Perpendicular API", version=API_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?)$",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def limit_body_size(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "payload excede 5 MB"})
    return await call_next(request)


def _unavailable() -> dict[str, str]:
    return {"status": "unavailable", "detail": UNAVAILABLE_DETAIL}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": API_VERSION}


@app.post("/api/v1/analyze/context")
def analyze_context(payload: ContextPayload) -> dict[str, str]:
    return _unavailable()


@app.post("/api/v1/analyze/frames")
def analyze_frames(payload: FramesPayload) -> dict[str, str]:
    return _unavailable()


@app.post("/api/v1/analyze/deep")
def analyze_deep(payload: DeepPayload) -> dict[str, str]:
    return _unavailable()


@app.post("/api/v1/feedback")
def feedback(payload: FeedbackPayload) -> dict[str, str]:
    append_feedback(payload)
    return {"status": "received"}
