from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field

from .common import StrictModel


class CurrentState(StrictModel):
    phase: Literal["discuss_plan", "refine_plan", "execute_items", "finalize_plan", "finalized"]
    active_plan_id: Optional[str] = None
    active_plan_path: str


class ItemCounters(StrictModel):
    open: int = Field(ge=0)
    review: int = Field(ge=0)
    done: int = Field(ge=0)


class LastTransition(StrictModel):
    at: Optional[str] = None
    from_: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None
    reason: Optional[str] = None


class WorkflowStateDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["workflow_state"]
    notes: list[str]
    current: CurrentState
    item_counters: ItemCounters
    last_transition: LastTransition
