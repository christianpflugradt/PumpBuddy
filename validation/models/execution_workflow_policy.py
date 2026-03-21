from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import Field

from .common import StrictModel


class Transition(StrictModel):
    from_: str = Field(alias="from")
    to: str
    when: List[str] = Field(min_length=1)
    effect: Optional[List[str]] = None


class StateMachine(StrictModel):
    states: List[str] = Field(min_length=1)
    transitions: List[Transition] = Field(min_length=1)


class OptionalStepPolicy(StrictModel):
    plan_item_required_when_any: List[str] = Field(min_length=1)


class ItemWorkflow(StrictModel):
    filename_status_source_of_truth: bool
    allowed_statuses: List[Literal["open", "review", "done"]] = Field(min_length=1)
    mandatory_steps: List[str] = Field(min_length=1)
    optional_steps: List[str] = Field(default_factory=list)
    optional_step_policy: Optional[OptionalStepPolicy] = None


class TokenEfficiency(StrictModel):
    tracking_scope: str
    primary_metrics: List[str] = Field(min_length=1)


class Intent(StrictModel):
    outcome: str
    principles: List[str] = Field(min_length=1)
    planning_size_guideline: Optional[Dict[str, Any]] = None


class ExtendedReviews(StrictModel):
    allowed_only_when: List[str] = Field(min_length=1)
    recommended_modes: List[str] = Field(min_length=1)
    findings_handling: List[str] = Field(min_length=1)


class QualityGates(StrictModel):
    fail_on: List[str] = Field(min_length=1)


class WorkflowPolicyDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["workflow_policy"]
    intent: Intent
    state_machine: StateMachine
    item_workflow: ItemWorkflow
    quality_gates: QualityGates
    extended_reviews: ExtendedReviews
    token_efficiency: TokenEfficiency
