from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Classification = Literal[
    "declared_ai",
    "likely_ai",
    "possibly_ai",
    "insufficient_evidence",
    "inconclusive",
    "error",
]

Expected = Literal["false_positive", "false_negative"]

_HashtagStr = Annotated[str, Field(max_length=100)]
_LegacyFrameStr = Annotated[str, Field(max_length=1_400_000)]
_VisualFrameStr = Annotated[str, Field(max_length=250_000)]

MAX_TOTAL_TEXT_CHARS = 20_000


class ContextPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: str = Field(max_length=50)
    page_url: str = Field(max_length=2000)
    title: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=10_000)
    hashtags: Annotated[list[_HashtagStr], Field(max_length=50)] = Field(default_factory=list)
    author_name: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def check_total_text_length(self) -> "ContextPayload":
        # Defesa em profundidade: com os limites de campo acima o total nunca
        # ultrapassa 15 500 caracteres, mas o limite explícito é 20 000.
        total = len(self.title or "") + len(self.description or "") + sum(
            len(tag) for tag in self.hashtags
        )
        if total > MAX_TOTAL_TEXT_CHARS:
            raise ValueError(f"texto total excede {MAX_TOTAL_TEXT_CHARS} caracteres")
        return self


class LocalDetectorPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=100)
    version: str = Field(max_length=100)
    decision: Literal["ai_like", "real_like", "uncertain", "unavailable"]
    score: float = Field(ge=0, le=1)


class FramesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    frames: Annotated[list[_VisualFrameStr], Field(min_length=4, max_length=16)]
    frame_fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    sample_rate_fps: Literal[8]
    duration_seconds: Literal[2]
    reason: Literal[
        "political_context",
        "local_positive",
        "local_uncertain",
        "local_unavailable",
        "signal_conflict",
        "manual_request",
    ]
    local_detector: LocalDetectorPayload | None = None

    @model_validator(mode="after")
    def check_total_frame_length(self) -> "FramesPayload":
        if sum(len(frame) for frame in self.frames) > 4_000_000:
            raise ValueError("frames excedem 4 milhões de caracteres")
        return self


class DeepVisualResult(BaseModel):
    status: Literal["analyzed", "unavailable"]
    detector: Literal["stall-dinov3-vitl16"] = "stall-dinov3-vitl16"
    detector_version: str
    calibration_version: str
    spatial_score: float | None = Field(default=None, ge=0, le=1)
    temporal_score: float | None = Field(default=None, ge=0, le=1)
    synthetic_score: float | None = Field(default=None, ge=0, le=1)
    decision: Literal["ai_like", "real_like", "uncertain"] | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    sampled_frames: int = Field(ge=0, le=16)
    warnings: list[str] = Field(default_factory=list)


class DeepPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: ContextPayload
    frames: Annotated[list[_LegacyFrameStr], Field(min_length=1, max_length=6)] | None = None


class FeedbackPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    classification: Classification
    score: float = Field(ge=0, le=1)
    assessment_version: str
    ruleset_version: str
    expected: Expected
    comment: str | None = Field(default=None, max_length=1000)
