from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field, model_validator

from .common import Formatting, References, StrictModel


class Capability(StrictModel):
    id: str
    name: str
    description: str
    modes: List[Literal["configured_gym", "free"]] = Field(min_length=1)
    includes: List[str] = Field(min_length=1)
    guarantees: List[str] = Field(min_length=1)
    notes: Optional[List[str]] = None


class Boundaries(StrictModel):
    in_scope: List[str]
    out_of_scope: List[str]


class WorkoutCapabilitiesDoc(StrictModel):
    version: Literal[1]
    area: Literal["workout"]
    source_of_truth: Literal["capabilities"]
    references: References
    formatting: Formatting
    capabilities: List[Capability] = Field(min_length=1)
    principles: List[str] = Field(min_length=1)
    non_goals: List[str] = Field(min_length=1)
    referenced_domain_rules: List[str] = Field(min_length=1)
    boundaries: Boundaries

    @model_validator(mode="after")
    def ensure_unique_capability_ids(self) -> "WorkoutCapabilitiesDoc":
        ids = [capability.id for capability in self.capabilities]
        if len(ids) != len(set(ids)):
            raise ValueError("capability ids must be unique")
        return self
