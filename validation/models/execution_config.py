from __future__ import annotations

from typing import Literal

from pydantic import Field

from .common import StrictModel


class GitConfig(StrictModel):
    commit_enabled: bool
    push_enabled: bool
    pull_rebase_before_push: bool


class RuntimeConfig(StrictModel):
    dry_run: bool


class IdFormatConfig(StrictModel):
    plan_numeric_length: int = Field(gt=0)
    item_numeric_length: int = Field(gt=0)


class TelemetryConfig(StrictModel):
    enabled: bool


class ReleaseConfig(StrictModel):
    trigger_on_finalize_accept: bool


class ExecutionConfigDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["execution_config"]
    id_format: IdFormatConfig
    runtime: RuntimeConfig
    git: GitConfig
    telemetry: TelemetryConfig
    release: ReleaseConfig
