from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel
from .template_item_template import AcceptanceCriterion


class Inputs(StrictModel):
    required: List[str] = Field(min_length=1)
    optional: List[str] = Field(default_factory=list)


class FinalizeReturnItem(StrictModel):
    title: str
    intent_outcome: str
    rationale: str
    scope_in: List[str] = Field(min_length=1)
    scope_out: List[str] = Field(min_length=1)
    constraints: List[str] = Field(min_length=1)
    inputs: Inputs
    acceptance_criteria: List[AcceptanceCriterion] = Field(min_length=1)
    risk_level: str
    boundary_impact: List[str] = Field(min_length=1)
    review_focus: List[str] = Field(min_length=1)


class FinalizeReturnFindingsDoc(StrictModel):
    version: Literal[1]
    kind: Literal["finalize_return_findings"]
    items: List[FinalizeReturnItem] = Field(min_length=1)
