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
_FrameStr = Annotated[str, Field(max_length=1_400_000)]

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
        # ultrapassa 15 500 caracteres, mas o limite de 20 000 é o contrato
        # documentado em docs/detection-pipeline.md §8 e fica explícito aqui.
        total = len(self.title or "") + len(self.description or "") + sum(
            len(tag) for tag in self.hashtags
        )
        if total > MAX_TOTAL_TEXT_CHARS:
            raise ValueError(f"texto total excede {MAX_TOTAL_TEXT_CHARS} caracteres")
        return self


class FramesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: ContextPayload
    frames: Annotated[list[_FrameStr], Field(min_length=1, max_length=6)]


class DeepPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: ContextPayload
    frames: Annotated[list[_FrameStr], Field(min_length=1, max_length=6)] | None = None


class FeedbackPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    classification: Classification
    score: float = Field(ge=0, le=1)
    assessment_version: str
    ruleset_version: str
    expected: Expected
    comment: str | None = Field(default=None, max_length=1000)
