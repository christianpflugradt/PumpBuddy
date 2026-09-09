from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field, model_validator

from .common import RepoRelativePath, StrictModel


class Source(StrictModel):
    type: str
    reference: RepoRelativePath


class ItemSection(StrictModel):
    id: str
    title: str
    status_hint: Literal["open", "review", "done"]
    source: Source


class Intent(StrictModel):
    outcome: str
    rationale: str


class Scope(StrictModel):
    in_: List[str] = Field(alias="in", min_length=1)
    out: List[str] = Field(min_length=1)


class Inputs(StrictModel):
    required: List[RepoRelativePath] = Field(min_length=1)
    optional: List[RepoRelativePath] = Field(default_factory=list)


class Verification(StrictModel):
    type: str
    command: str
    expected: str


class AcceptanceCriterion(StrictModel):
    id: str
    statement: str
    verification: Verification


class Execution(StrictModel):
    plan_item_required: bool
    plan_item_skip_reason: Optional[str] = None
    independent_review_required: bool = False
    independent_review_reason: Optional[str] = None
    risk_level: str
    boundary_impact: List[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_plan_item_skip_reason(self) -> "Execution":
        if self.independent_review_required and not (self.independent_review_reason or "").strip():
            raise ValueError(
                "execution.independent_review_reason must be non-empty when execution.independent_review_required is true"
            )
        return self


class Handoff(StrictModel):
    review_focus: List[str] = Field(min_length=1)


class ReviewAcceptance(StrictModel):
    criteria_met: str
    evidence: str
    runtime_build_check: str
    residual_risk: str


class ReviewFinding(StrictModel):
    criterion: str
    evidence: str
    risk: str
    requires_api_contract_update: bool = False


class ReviewFeedbackEntry(StrictModel):
    at: str
    source: str
    notes: str
    findings: List[ReviewFinding] = Field(default_factory=list)


class ReviewResult(StrictModel):
    outcome: Literal["accept", "return"]
    acceptance: Optional[ReviewAcceptance] = None
    findings: List[ReviewFinding] = Field(default_factory=list)


class BacklogItemTemplateDoc(StrictModel):
    version: Literal[1]
    kind: Literal["backlog_item"]
    item: ItemSection
    intent: Intent
    scope: Scope
    constraints: List[str] = Field(min_length=1)
    inputs: Inputs
    acceptance_criteria: List[AcceptanceCriterion] = Field(min_length=1)
    execution: Execution
    handoff: Handoff
    review_feedback: List[ReviewFeedbackEntry] = Field(default_factory=list)
    review_result: Optional[ReviewResult] = None
