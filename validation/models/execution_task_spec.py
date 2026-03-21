from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class Intent(StrictModel):
    outcome: str


class FinalizeBehavior(StrictModel):
    config_path: str
    dry_run: List[str] = Field(min_length=1)
    non_dry_run: List[str] = Field(min_length=1)


class ScriptContract(StrictModel):
    dispatcher_script: str
    task_script: str
    finalize_script: str
    context_config: str


class TaskSpecDoc(StrictModel):
    version: Literal[1]
    task: str
    source_of_truth: Literal["task_spec"]
    intent: Intent
    pre_conditions: List[str] = Field(min_length=1)
    flow: List[str] = Field(min_length=1)
    post_conditions: List[str] = Field(min_length=1)
    finalize_behavior: FinalizeBehavior
    script_contract: ScriptContract
