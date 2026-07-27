from __future__ import annotations

import hashlib
import importlib
import importlib.util
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol, cast

STALL_COMMIT = "bfcc603ae83b4e609681277b9b5e80e7a9497e15"
STALL_PARAMS_SHA256 = "beede546ca4385242c2a26075b8087ab51bee709549fc4ddc79d0eef5acce240"
DETECTOR_VERSION = f"stall-{STALL_COMMIT[:8]}-dinov3-vitl16"
CALIBRATION_VERSION = f"vatex-{STALL_PARAMS_SHA256[:8]}"


@dataclass(frozen=True)
class StallScores:
    spatial_score: float
    temporal_score: float
    synthetic_score: float


class StallDetector(Protocol):
    def analyze(self, frames: list[bytes]) -> StallScores: ...


class ConfiguredStallDetector:
    def __init__(self) -> None:
        stall_repo = Path(os.environ["STALL_REPO_DIR"])
        params_path = Path(os.environ["STALL_PARAMS_PATH"])
        dino_repo = Path(os.environ["DINO_V3_REPO_DIR"])
        dino_weights = Path(os.environ["DINO_V3_WEIGHTS"])
        for path in (stall_repo, params_path, dino_repo, dino_weights):
            if not path.exists():
                raise RuntimeError("stall_artifact_missing")
        if hashlib.sha256(params_path.read_bytes()).hexdigest() != STALL_PARAMS_SHA256:
            raise RuntimeError("stall_params_hash_mismatch")

        module_path = stall_repo / "src" / "stall.py"
        spec = importlib.util.spec_from_file_location("bp_upstream_stall", module_path)
        if spec is None or spec.loader is None:
            raise RuntimeError("stall_module_unavailable")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        numpy = importlib.import_module("numpy")
        torch = importlib.import_module("torch")
        device = os.getenv("STALL_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
        stall_class = cast(Any, module).STALL
        self._numpy = numpy
        self._cv2 = importlib.import_module("cv2")
        self._model = stall_class(
            device=device,
            data_dict=numpy.load(params_path),
            dino_repo=str(dino_repo),
            dino_weights=str(dino_weights),
        )

    def analyze(self, frames: list[bytes]) -> StallScores:
        decoded = [
            self._cv2.imdecode(self._numpy.frombuffer(frame, dtype=self._numpy.uint8), 1)
            for frame in frames
        ]
        if any(frame is None for frame in decoded):
            raise ValueError("jpeg_decode_failed")
        embeddings = self._model.frames_to_embeddings([self._numpy.stack(decoded)])
        result = self._model._scores_from_embs(embeddings)
        spatial_real = float(result["spat_percentile"][0])
        temporal_real = float(result["temp_percentile"][0])
        final_real = float(result["final_score"][0])
        return StallScores(
            spatial_score=1 - spatial_real,
            temporal_score=1 - temporal_real,
            synthetic_score=1 - final_real,
        )


@lru_cache(maxsize=1)
def get_configured_detector() -> StallDetector | None:
    if os.getenv("STALL_ENABLED", "false").lower() != "true":
        return None
    if os.getenv("STALL_NONCOMMERCIAL_ACKNOWLEDGED", "false").lower() != "true":
        return None
    required = ("STALL_REPO_DIR", "STALL_PARAMS_PATH", "DINO_V3_REPO_DIR", "DINO_V3_WEIGHTS")
    if any(not os.getenv(name) for name in required):
        return None
    try:
        return ConfiguredStallDetector()
    except (ImportError, KeyError, OSError, RuntimeError, ValueError):
        return None
