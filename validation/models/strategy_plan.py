from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import RepoRelativePath, StrictModel


class PlanDoc(StrictModel):
    version: Literal[1]
    kind: Literal["plan"]
    id: str
    name: str
    goal: str
    scope: List[str] = Field(min_length=1)
    out_of_scope: List[str] = Field(min_length=1)
    success_criteria: List[str] = Field(min_length=1)
    constraints: List[str] = Field(min_length=1)
    inputs: List[RepoRelativePath] = Field(min_length=1)
    refinement_note: str
