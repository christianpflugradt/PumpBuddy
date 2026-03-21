from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class Source(StrictModel):
    type: str
    reference: str


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
    required: List[str] = Field(min_length=1)
    optional: List[str] = Field(default_factory=list)


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
    risk_level: str
    boundary_impact: List[str] = Field(min_length=1)


class Handoff(StrictModel):
    review_focus: List[str] = Field(min_length=1)


class ReviewFeedbackEntry(StrictModel):
    at: str
    source: str
    notes: str


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
