from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field

from .common import StrictModel


class DecisionField(StrictModel):
    allowed_values: List[Literal["accept"]] = Field(min_length=1)


class TypedField(StrictModel):
    type: Literal["string", "list"]
    min_items: Optional[int] = Field(default=None, ge=1)
    allow_none_literal: Optional[bool] = None


class FinalizePlanAcceptFields(StrictModel):
    stakeholder_decision: DecisionField
    scope_confirmed: TypedField
    evidence_reviewed: TypedField
    residual_concerns: TypedField


class FinalizePlanAcceptTemplateDoc(StrictModel):
    version: Literal[1]
    kind: Literal["finalize_plan_accept_template"]
    required_sections: List[str] = Field(min_length=4)
    fields: FinalizePlanAcceptFields
