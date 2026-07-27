from __future__ import annotations

import json
import base64
from typing import Any

from fastapi.testclient import TestClient

from app.main import MAX_BODY_BYTES, UNAVAILABLE_DETAIL, app

client = TestClient(app)


def valid_context() -> dict[str, Any]:
    return {
        "platform": "tiktok",
        "page_url": "https://tiktok.com/@user/video/123",
        "title": "Titulo do video",
        "description": "Descricao curta sobre o video",
        "hashtags": ["ia", "deepfake"],
        "author_name": "Autor Exemplo",
    }


def valid_feedback() -> dict[str, Any]:
    return {
        "classification": "possibly_ai",
        "score": 0.42,
        "assessment_version": "1.0.0",
        "ruleset_version": "1.0.0",
        "expected": "false_positive",
        "comment": "comentario opcional",
    }


def fake_jpeg(width: int = 32, height: int = 32) -> str:
    # Cabeçalho JPEG mínimo suficiente para a validação estrutural; o detector
    # falso dos testes não decodifica pixels.
    sof = bytes.fromhex("ffd8ffc0001108") + height.to_bytes(2, "big") + width.to_bytes(2, "big")
    sof += bytes.fromhex("03011100021100031100ffd9")
    return "data:image/jpeg;base64," + base64.b64encode(sof).decode()


def valid_frames() -> dict[str, Any]:
    return {
        "frames": [fake_jpeg()] * 4,
        "frame_fingerprint": "a" * 64,
        "sample_rate_fps": 8,
        "duration_seconds": 2,
        "reason": "local_uncertain",
    }


def test_health() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "0.3.0"}


def test_analyze_context_returns_unavailable() -> None:
    resp = client.post("/api/v1/analyze/context", json=valid_context())
    assert resp.status_code == 200
    assert resp.json() == {"status": "unavailable", "detail": UNAVAILABLE_DETAIL}


def test_analyze_frames_returns_unavailable() -> None:
    resp = client.post("/api/v1/analyze/frames", json=valid_frames())
    assert resp.status_code == 200
    assert resp.json()["status"] == "unavailable"


def test_analyze_deep_returns_unavailable_without_frames() -> None:
    resp = client.post("/api/v1/analyze/deep", json={"context": valid_context()})
    assert resp.status_code == 200
    assert resp.json()["status"] == "unavailable"


def test_analyze_deep_returns_unavailable_with_frames() -> None:
    payload = {
        "context": valid_context(),
        "frames": ["data:image/jpeg;base64," + "A" * 100],
    }
    resp = client.post("/api/v1/analyze/deep", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "unavailable"


def test_context_too_large_rejected() -> None:
    payload = valid_context() | {"description": "x" * 20_001}
    assert client.post("/api/v1/analyze/context", json=payload).status_code == 422


def test_context_max_combined_text_accepted() -> None:
    # Soma máxima possível respeitando os limites por campo (500 + 10000 +
    # 50*100 = 15500) fica abaixo do limite total de 20000: deve passar.
    payload = valid_context() | {
        "title": "t" * 500,
        "description": "d" * 10_000,
        "hashtags": ["h" * 100 for _ in range(50)],
    }
    resp = client.post("/api/v1/analyze/context", json=payload)
    assert resp.status_code == 200


def test_frames_over_limit_rejected() -> None:
    payload = valid_frames() | {"frames": [fake_jpeg()] * 17}
    assert client.post("/api/v1/analyze/frames", json=payload).status_code == 422


def test_frame_too_big_rejected() -> None:
    payload = valid_frames() | {"frames": ["A" * 250_001] * 4}
    assert client.post("/api/v1/analyze/frames", json=payload).status_code == 422


def test_unknown_fields_rejected() -> None:
    payload = valid_context() | {"unexpected_field": "nope"}
    assert client.post("/api/v1/analyze/context", json=payload).status_code == 422


def test_feedback_returns_received(tmp_path: Any, monkeypatch: Any) -> None:
    monkeypatch.setenv("FEEDBACK_PATH", str(tmp_path / "feedback.jsonl"))
    resp = client.post("/api/v1/feedback", json=valid_feedback())
    assert resp.status_code == 200
    assert resp.json() == {"status": "received"}


def test_feedback_invalid_expected_rejected() -> None:
    payload = valid_feedback() | {"expected": "not_a_valid_value"}
    assert client.post("/api/v1/feedback", json=payload).status_code == 422


def test_feedback_unknown_fields_rejected() -> None:
    payload = valid_feedback() | {"extra": "nope"}
    assert client.post("/api/v1/feedback", json=payload).status_code == 422


def test_feedback_persisted_sanitized(tmp_path: Any, monkeypatch: Any) -> None:
    feedback_path = tmp_path / "feedback.jsonl"
    monkeypatch.setenv("FEEDBACK_PATH", str(feedback_path))

    resp = client.post("/api/v1/feedback", json=valid_feedback())
    assert resp.status_code == 200

    lines = feedback_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    entry = json.loads(lines[0])

    expected_keys = {
        "classification",
        "score",
        "assessment_version",
        "ruleset_version",
        "expected",
        "comment",
        "received_at",
    }
    assert set(entry.keys()) == expected_keys
    assert entry["classification"] == "possibly_ai"
    assert entry["expected"] == "false_positive"


def test_body_over_5mb_rejected() -> None:
    big = b"a" * (MAX_BODY_BYTES + 100_000)
    resp = client.post(
        "/api/v1/feedback",
        content=big,
        headers={"content-type": "application/json"},
    )
    assert resp.status_code == 413
