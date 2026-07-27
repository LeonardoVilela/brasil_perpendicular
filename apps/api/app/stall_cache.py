from __future__ import annotations

import os
import sqlite3
from pathlib import Path

from app.models import DeepVisualResult


class StallCache:
    def __init__(self) -> None:
        self.path = Path(os.getenv("STALL_CACHE_PATH", "data/stall-cache.sqlite3"))
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS stall_results (
                fingerprint TEXT NOT NULL,
                detector_version TEXT NOT NULL,
                calibration_version TEXT NOT NULL,
                result_json TEXT NOT NULL,
                PRIMARY KEY (fingerprint, detector_version, calibration_version)
            )
            """
        )
        return connection

    def get(
        self, fingerprint: str, detector_version: str, calibration_version: str
    ) -> DeepVisualResult | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT result_json FROM stall_results WHERE fingerprint=? AND detector_version=? AND calibration_version=?",
                (fingerprint, detector_version, calibration_version),
            ).fetchone()
        return DeepVisualResult.model_validate_json(row[0]) if row else None

    def put(self, fingerprint: str, result: DeepVisualResult) -> None:
        if result.status != "analyzed":
            return
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO stall_results VALUES (?, ?, ?, ?)",
                (
                    fingerprint,
                    result.detector_version,
                    result.calibration_version,
                    result.model_dump_json(),
                ),
            )
