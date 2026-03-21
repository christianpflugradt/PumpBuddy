from __future__ import annotations

from typing import List, Literal

from pydantic import Field, model_validator

from .common import Formatting, StrictModel


class GlossaryTokenSets(StrictModel):
    workout_mode: List[str] = Field(min_length=1)
    boundary_scope: List[str] = Field(min_length=1)
    shared_domain_rules: List[str] = Field(min_length=1)
    lifecycle_policy: List[str] = Field(min_length=1)
    capability_id: List[str] = Field(min_length=1)
    use_case_id: List[str] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_ids(self) -> "GlossaryTokenSets":
        for capability in self.capability_id:
            if "." not in capability:
                raise ValueError(f"invalid capability id '{capability}': expected dotted format")
        for use_case in self.use_case_id:
            if not use_case.startswith("UC-"):
                raise ValueError(f"invalid use case id '{use_case}': expected UC-* format")
        return self


class GlossaryDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["shared_tokens"]
    formatting: Formatting
    token_sets: GlossaryTokenSets
    naming_rules: List[str] = Field(min_length=1)
