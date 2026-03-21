from __future__ import annotations

from typing import Any, List, Literal, Optional

from pydantic import Field, model_validator

from .common import Formatting, References, StrictModel


class DbLifecycleImplementation(StrictModel):
    id: str
    db_strategy: List[str]


class Decision(StrictModel):
    id: str
    decision: str
    rationale: str


class DomainRuleImplementation(StrictModel):
    rule: str
    implemented_by: List[str]


class Column(StrictModel):
    name: str
    type: str
    nullable: bool
    default: Optional[Any] = None


class ForeignKey(StrictModel):
    columns: List[str]
    references: str


class ConstraintColumns(StrictModel):
    columns: List[str] = Field(min_length=1)


class Table(StrictModel):
    name: str
    lifecycle_policy: str
    columns: List[Column]
    primary_key: List[str]
    foreign_keys: Optional[List[ForeignKey]] = None
    unique_constraints: Optional[List[ConstraintColumns]] = None
    indexes: Optional[List[ConstraintColumns]] = None
    checks: Optional[List[str]] = None


class PersistenceModelDoc(StrictModel):
    version: Literal[1]
    database: Literal["postgresql"]
    source_of_truth: Literal["persistence-layout"]
    references: References
    formatting: Formatting
    lifecycle_policy_implementation: List[DbLifecycleImplementation] = Field(min_length=1)
    principles: List[str] = Field(min_length=1)
    decisions: List[Decision] = Field(min_length=1)
    tables: List[Table] = Field(min_length=1)
    domain_rule_implementations: Optional[List[DomainRuleImplementation]] = None

    @model_validator(mode="after")
    def ensure_unique_table_names(self) -> "PersistenceModelDoc":
        names = [table.name for table in self.tables]
        if len(names) != len(set(names)):
            raise ValueError("table names must be unique")
        return self
