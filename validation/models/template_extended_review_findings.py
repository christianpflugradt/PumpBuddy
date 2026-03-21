from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel
from .template_item_template import AcceptanceCriterion


class Inputs(StrictModel):
    required: List[str] = Field(min_length=1)
    optional: List[str] = Field(default_factory=list)


class ProposedBacklogItem(StrictModel):
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


class Finding(StrictModel):
    id: str
    title: str
    priority: Literal["p0", "p1", "p2", "p3"]
    summary: str
    evidence: List[str] = Field(min_length=1)
    risk: str
    proposed_backlog_item: ProposedBacklogItem


class Summary(StrictModel):
    reviewed_scope: str
    overall_assessment: str


class ExtendedReviewFindingsTemplateDoc(StrictModel):
    version: Literal[1]
    kind: Literal["extended_review_findings"]
    review_task: str
    summary: Summary
    items: List[Finding] = Field(min_length=1)
