from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import Field

from .common import ApprovedException, Formatting, StrictModel


class Authority(StrictModel):
    applies_to: List[str]


class SectionRules(StrictModel):
    required: Optional[List[str]] = None
    forbidden: Optional[List[str]] = None
    flexible: Optional[List[str]] = None
    allowed_scopes: Optional[List[str]] = None


class EngineeringGuardrailsDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["engineering_guardrails"]
    formatting: Formatting
    authority: Authority
    repository_rules: SectionRules
    maintainability_rules: SectionRules
    dependency_rules: SectionRules
    configuration_rules: SectionRules
    error_handling_rules: SectionRules
    logging_rules: SectionRules
    code_generation_rules: SectionRules
    persistence_rules: SectionRules
    api_rules: SectionRules
    runtime_container_rules: SectionRules
    approved_exceptions: Optional[List[ApprovedException]] = None
    temp_artifact_rules: SectionRules
    commit_versioning_rules: SectionRules
