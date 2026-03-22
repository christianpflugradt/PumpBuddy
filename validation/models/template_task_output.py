from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class TaskOutputTemplateDoc(StrictModel):
    version: Literal[1]
    kind: Literal["task_output_template"]
    status_values: List[Literal["SUCCESS", "FAILED", "BLOCKED"]] = Field(min_length=3)
    workspace_values: List[Literal["CLEAN", "DIRTY"]] = Field(min_length=2)
    required_lines: List[str] = Field(min_length=3)
    optional_lines: List[str] = Field(default_factory=list)
    rules: List[str] = Field(min_length=1)
