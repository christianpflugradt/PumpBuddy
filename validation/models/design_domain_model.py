from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field, model_validator

from .common import Formatting, References, StrictModel


class ValueSet(StrictModel):
    id: str
    values: List[str] = Field(min_length=1)


class Relationship(StrictModel):
    type: str
    target: str


class DomainEntity(StrictModel):
    name: str
    description: str
    attributes: List[str] = Field(min_length=1)
    relationships: List[Relationship] = Field(min_length=1)
    lifecycle_policy: str
    states: Optional[List[str]] = None


class LifecyclePolicy(StrictModel):
    id: str
    description: str


class Invariant(StrictModel):
    id: str
    rule: str


class DomainModelDoc(StrictModel):
    version: Literal[1]
    scope: str
    source_of_truth: Literal["domain-structure"]
    references: References
    formatting: Formatting
    value_sets: List[ValueSet] = Field(min_length=1)
    lifecycle_policies: List[LifecyclePolicy] = Field(min_length=1)
    entities: List[DomainEntity] = Field(min_length=1)
    invariants: List[Invariant] = Field(min_length=1)

    @model_validator(mode="after")
    def ensure_unique_entity_names(self) -> "DomainModelDoc":
        names = [entity.name for entity in self.entities]
        if len(names) != len(set(names)):
            raise ValueError("entity names must be unique")
        return self
