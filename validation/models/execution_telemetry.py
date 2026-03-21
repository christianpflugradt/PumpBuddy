from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field

from .common import StrictModel


class TelemetryOutlierDuration(StrictModel):
    item_id: str
    duration_seconds: int = Field(ge=0)


class TelemetryOutlierRework(StrictModel):
    item_id: str
    return_count: int = Field(ge=0)


class TelemetryOutlierFindings(StrictModel):
    item_id: str
    findings_count: int = Field(ge=0)


class TelemetryQualityDistribution(StrictModel):
    good: int = Field(ge=0)
    ok: int = Field(ge=0)
    poor: int = Field(ge=0)


class TelemetrySummary(StrictModel):
    started_at: Optional[str]
    last_updated_at: Optional[str]
    duration_seconds: int = Field(ge=0)
    task_runs_total: int = Field(ge=0)
    items_total: int = Field(ge=0)
    items_done: int = Field(ge=0)
    items_returned_at_least_once: int = Field(ge=0)
    rework_cycles_total: int = Field(ge=0)
    rework_cycles_avg_per_item: float = Field(ge=0)
    findings_total_item_review: int = Field(ge=0)
    findings_total_finalize: int = Field(ge=0)
    findings_total_extended_review: int = Field(ge=0)
    first_pass_accept_rate: float = Field(ge=0, le=1)
    context_files_loaded_total: int = Field(ge=0)
    context_bytes_loaded_total: int = Field(ge=0)
    outlier_item_by_duration: Optional[TelemetryOutlierDuration]
    outlier_item_by_rework: Optional[TelemetryOutlierRework]
    outlier_item_by_findings: Optional[TelemetryOutlierFindings]
    item_quality_distribution: TelemetryQualityDistribution


class TelemetryEvent(StrictModel):
    at: str
    task: str
    event_type: str
    item_id: Optional[str] = None
    outcome: Optional[str] = None
    findings_count: Optional[int] = Field(default=None, ge=0)
    context_files: Optional[int] = Field(default=None, ge=0)
    context_bytes: Optional[int] = Field(default=None, ge=0)
    created_open_items: Optional[int] = Field(default=None, ge=0)
    selected_mode: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None


class TelemetryDetails(StrictModel):
    events: list[TelemetryEvent]


class TelemetryDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["execution_telemetry"]
    plan_id: str
    summary: TelemetrySummary
    details: TelemetryDetails
