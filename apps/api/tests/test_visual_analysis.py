from __future__ import annotations

import base64
import sqlite3
from pathlib import Path
from typing import Any, Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.stall_service import StallScores, get_configured_detector

client = TestClient(app)


def fake_jpeg(width: int = 32, height: int = 32) -> str:
    sof = bytes.fromhex("ffd8ffc0001108") + height.to_bytes(2, "big") + width.to_bytes(2, "big")
    sof += bytes.fromhex("03011100021100031100ffd9")
    return "data:image/jpeg;base64," + base64.b64encode(sof).decode()


def payload(fingerprint: str = "b" * 64) -> dict[str, Any]:
    return {
        "frames": [fake_jpeg()] * 4,
        "frame_fingerprint": fingerprint,
        "sample_rate_fps": 8,
        "duration_seconds": 2,
        "reason": "political_context",
        "local_detector": {
            "name": "d3-mobilenetv3",
            "version": "test",
            "decision": "uncertain",
            "score": 0.5,
        },
    }


class FakeStall:
    def __init__(self, synthetic_score: float = 0.98) -> None:
        self.synthetic_score = synthetic_score
        self.calls = 0

    def analyze(self, frames: list[bytes]) -> StallScores:
        self.calls += 1
        assert len(frames) == 4
        return StallScores(0.97, 0.99, self.synthetic_score)


@pytest.fixture(autouse=True)
def isolate_stall(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("STALL_CACHE_PATH", str(tmp_path / "stall.sqlite3"))
    monkeypatch.setenv("STALL_ENABLED", "false")
    app.state.stall_detector = None
    get_configured_detector.cache_clear()
    yield
    app.state.stall_detector = None
    get_configured_detector.cache_clear()


def test_analyzed_response_uses_stall_scores() -> None:
    app.state.stall_detector = FakeStall()
    response = client.post("/api/v1/analyze/frames", json=payload())

    assert response.status_code == 200
    assert response.json()["status"] == "analyzed"
    assert response.json()["detector"] == "stall-dinov3-vitl16"
    assert response.json()["decision"] == "ai_like"
    assert response.json()["synthetic_score"] == pytest.approx(0.98)


def test_same_fingerprint_hits_sqlite_cache_without_new_inference(tmp_path: Path) -> None:
    detector = FakeStall()
    app.state.stall_detector = detector
    request = payload("c" * 64)

    first = client.post("/api/v1/analyze/frames", json=request)
    second = client.post("/api/v1/analyze/frames", json=request)

    assert first.json() == second.json()
    assert detector.calls == 1
    cache_path = Path(str(tmp_path / "stall.sqlite3"))
    with sqlite3.connect(cache_path) as connection:
        stored = connection.execute("SELECT result_json FROM stall_results").fetchone()[0]
    assert "data:image" not in stored


def test_unconfigured_backend_degrades_explicitly() -> None:
    response = client.post("/api/v1/analyze/frames", json=payload())
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert response.json()["warnings"] == ["stall_not_configured"]


@pytest.mark.parametrize(
    "frames",
    [
        ["data:image/png;base64,AAAA"] * 4,
        ["data:image/jpeg;base64,não-base64"] * 4,
        [fake_jpeg(2048, 32)] * 4,
    ],
)
def test_invalid_frame_content_is_rejected(frames: list[str]) -> None:
    response = client.post("/api/v1/analyze/frames", json=payload() | {"frames": frames})
    assert response.status_code == 422


def test_privacy_contract_rejects_context_url_or_author() -> None:
    request = payload() | {
        "context": {"title": "Lula"},
        "page_url": "https://example.com/video",
        "author_name": "autor",
    }
    assert client.post("/api/v1/analyze/frames", json=request).status_code == 422
