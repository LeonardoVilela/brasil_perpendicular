from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.feedback_store import append_feedback
from app.frame_validation import decode_and_validate_frames
from app.models import (
    ContextPayload,
    DeepPayload,
    DeepVisualResult,
    FeedbackPayload,
    FramesPayload,
)
from app.stall_cache import StallCache
from app.stall_service import (
    CALIBRATION_VERSION,
    DETECTOR_VERSION,
    StallDetector,
    StallScores,
    get_configured_detector,
)

API_VERSION = "0.3.0"
MAX_BODY_BYTES = 5_242_880
UNAVAILABLE_DETAIL = "Análise profunda ainda não implementada nesta versão."
_stall_slots = asyncio.Semaphore(max(1, int(os.getenv("STALL_MAX_CONCURRENT", "1"))))

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


def _visual_unavailable(sampled_frames: int, warning: str) -> DeepVisualResult:
    return DeepVisualResult(
        status="unavailable",
        detector_version=DETECTOR_VERSION,
        calibration_version=CALIBRATION_VERSION,
        sampled_frames=sampled_frames,
        warnings=[warning],
    )


def _visual_result(scores: StallScores, sampled_frames: int) -> DeepVisualResult:
    decision: Literal["ai_like", "real_like", "uncertain"]
    if scores.synthetic_score >= 0.95:
        decision = "ai_like"
        confidence = scores.synthetic_score
    elif scores.synthetic_score <= 0.20:
        decision = "real_like"
        confidence = 1 - scores.synthetic_score
    else:
        decision = "uncertain"
        confidence = max(scores.synthetic_score, 1 - scores.synthetic_score)
    return DeepVisualResult(
        status="analyzed",
        detector_version=DETECTOR_VERSION,
        calibration_version=CALIBRATION_VERSION,
        spatial_score=scores.spatial_score,
        temporal_score=scores.temporal_score,
        synthetic_score=scores.synthetic_score,
        decision=decision,
        confidence=confidence,
        sampled_frames=sampled_frames,
        warnings=[],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": API_VERSION}


@app.post("/api/v1/analyze/context")
def analyze_context(payload: ContextPayload) -> dict[str, str]:
    return _unavailable()


@app.post("/api/v1/analyze/frames", response_model=DeepVisualResult)
async def analyze_frames(payload: FramesPayload) -> DeepVisualResult:
    try:
        frames = decode_and_validate_frames(payload.frames)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    cache = StallCache()
    cached = cache.get(payload.frame_fingerprint, DETECTOR_VERSION, CALIBRATION_VERSION)
    if cached is not None:
        return cached

    try:
        await asyncio.wait_for(_stall_slots.acquire(), timeout=0.01)
    except TimeoutError:
        return _visual_unavailable(len(frames), "stall_saturated")
    try:
        detector: StallDetector | None = getattr(app.state, "stall_detector", None)
        detector = detector or await asyncio.to_thread(get_configured_detector)
        if detector is None:
            return _visual_unavailable(len(frames), "stall_not_configured")
        scores = await asyncio.to_thread(detector.analyze, frames)
        result = _visual_result(scores, len(frames))
        cache.put(payload.frame_fingerprint, result)
        return result
    except Exception:
        return _visual_unavailable(len(frames), "stall_inference_failed")
    finally:
        _stall_slots.release()


@app.post("/api/v1/analyze/deep")
def analyze_deep(payload: DeepPayload) -> dict[str, str]:
    return _unavailable()


@app.post("/api/v1/feedback")
def feedback(payload: FeedbackPayload) -> dict[str, str]:
    append_feedback(payload)
    return {"status": "received"}
