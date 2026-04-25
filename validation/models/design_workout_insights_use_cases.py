from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field, model_validator

from .common import Formatting, References, StrictModel


class ModeBehavior(StrictModel):
    configured_gym: Optional[List[str]] = None
    free: Optional[List[str]] = None


class Boundaries(StrictModel):
    in_scope: List[str]
    out_of_scope: List[str]


class UseCase(StrictModel):
    id: str
    name: str
    goal: str
    mode: Literal["configured_gym", "free", "configured_gym_and_free"]
    preconditions: List[str] = Field(min_length=1)
    main_flow: List[str] = Field(min_length=1)
    postconditions: List[str] = Field(min_length=1)
    mode_behavior: Optional[ModeBehavior] = None


class WorkoutInsightsUseCasesDoc(StrictModel):
    version: Literal[1]
    area: Literal["workout_insights"]
    source_of_truth: Literal["use_cases"]
    references: References
    formatting: Formatting
    use_cases: List[UseCase] = Field(min_length=1)
    cross_cutting_rules: List[str] = Field(min_length=1)
    boundaries: Boundaries

    @model_validator(mode="after")
    def ensure_unique_use_case_ids(self) -> "WorkoutInsightsUseCasesDoc":
        ids = [use_case.id for use_case in self.use_cases]
        if len(ids) != len(set(ids)):
            raise ValueError("use case ids must be unique")
        return self
