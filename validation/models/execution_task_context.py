from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class ContextSection(StrictModel):
    required: List[str] = Field(min_length=1)
    optional: List[str] = Field(default_factory=list)


class TemplatesSection(StrictModel):
    required: List[str] = Field(min_length=1)


class TaskContextDoc(StrictModel):
    version: Literal[1]
    task: str
    context: ContextSection
    templates: TemplatesSection
    on_demand_order: List[str] = Field(default_factory=list)
    finalize_script: str
    finalize_track_paths: List[str] = Field(min_length=1)
    instruction: str
