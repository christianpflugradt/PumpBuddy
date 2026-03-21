from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import Field, model_validator

from .common import Formatting, References, StrictModel


class PersistenceImpact(StrictModel):
    read: Optional[List[Any]] = None
    create: Optional[List[Any]] = None
    update: Optional[List[Any]] = None
    delete: Optional[List[Any]] = None
    keep: Optional[List[Any]] = None


class UseCaseDomainMappingItem(StrictModel):
    use_case_id: str
    use_case_name: str
    mode: Literal["configured_gym", "free", "configured_gym_and_free"]
    primary_entities: List[str] = Field(min_length=1)
    supporting_entities: List[str]
    key_rules: List[str] = Field(min_length=1)
    state_changes: List[str] = Field(min_length=1)
    persistence_impact: PersistenceImpact


class CrossCuttingFinding(StrictModel):
    id: str
    status: str
    description: str
    related_use_cases: List[str]


class WorkoutUseCasesToDomainModelDoc(StrictModel):
    version: Literal[1]
    area: Literal["workout"]
    source_of_truth: Literal["use_case_domain_mapping"]
    references: References
    formatting: Formatting
    mapping_conventions: Dict[str, str]
    mappings: List[UseCaseDomainMappingItem] = Field(min_length=1)
    cross_cutting_findings: List[CrossCuttingFinding]
    summary: List[str] = Field(min_length=1)

    @model_validator(mode="after")
    def ensure_unique_mapping_ids(self) -> "WorkoutUseCasesToDomainModelDoc":
        ids = [mapping.use_case_id for mapping in self.mappings]
        if len(ids) != len(set(ids)):
            raise ValueError("mapping use_case_id values must be unique")
        return self
