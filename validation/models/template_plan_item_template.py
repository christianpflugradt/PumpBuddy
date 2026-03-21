from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class PlanSection(StrictModel):
    item_id: str
    item_path: str
    title: str


class Summary(StrictModel):
    goal: str


class PlanContext(StrictModel):
    required: List[str] = Field(default_factory=list)
    optional: List[str] = Field(default_factory=list)


class PlanItemTemplateDoc(StrictModel):
    version: Literal[1]
    kind: Literal["item_plan"]
    plan: PlanSection
    summary: Summary
    context: PlanContext
    implementation_approach: List[str] = Field(min_length=1)
    risks_and_assumptions: List[str] = Field(min_length=1)
    validation_plan: List[str] = Field(min_length=1)
    out_of_scope: List[str] = Field(min_length=1)
    handoff_notes: List[str] = Field(min_length=1)
