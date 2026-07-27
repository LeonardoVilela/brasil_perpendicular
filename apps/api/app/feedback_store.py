from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from app.models import FeedbackPayload

DEFAULT_FEEDBACK_PATH = Path(__file__).resolve().parent.parent / "data" / "feedback.jsonl"


def _feedback_path() -> Path:
    raw = os.environ.get("FEEDBACK_PATH")
    return Path(raw) if raw else DEFAULT_FEEDBACK_PATH


def append_feedback(payload: FeedbackPayload) -> None:
    """Grava apenas os campos do modelo + received_at, nunca dados extras."""
    path = _feedback_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = payload.model_dump()
    entry["received_at"] = datetime.now(UTC).isoformat()
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
