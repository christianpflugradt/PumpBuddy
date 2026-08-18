from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import RepoRelativePath, StrictModel


class ContextSection(StrictModel):
    required: List[RepoRelativePath] = Field(min_length=1)
    optional: List[RepoRelativePath] = Field(default_factory=list)


class TemplatesSection(StrictModel):
    required: List[RepoRelativePath] = Field(min_length=1)


class TaskContextDoc(StrictModel):
    version: Literal[1]
    task: str
    context: ContextSection
    templates: TemplatesSection
    on_demand_order: List[RepoRelativePath] = Field(default_factory=list)
    finalize_script: RepoRelativePath
    finalize_track_paths: List[RepoRelativePath] = Field(min_length=1)
    instruction: str
