from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class QualityGateRule(StrictModel):
    id: str
    path_any: List[str] = Field(min_length=1)
    commands: List[str] = Field(min_length=1)


class QualityGatesDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["quality_gates"]
    rules: List[QualityGateRule] = Field(min_length=1)
