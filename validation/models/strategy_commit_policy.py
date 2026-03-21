from __future__ import annotations

from typing import List, Literal

from pydantic import Field

from .common import StrictModel


class ScopeRules(StrictModel):
    optional: bool
    allowed_values: List[str] = Field(min_length=1)
    forbid_scope_equal_to_type: bool


class DocsNote(StrictModel):
    docs_type_excluded_from_release_notes: bool


class ConventionalCommitRules(StrictModel):
    subject_required: bool
    body_optional: bool
    breaking_change_marker_allowed: bool
    allowed_types: List[str] = Field(min_length=1)
    scope: ScopeRules
    docs_note: DocsNote


class ValidationRules(StrictModel):
    first_line_regex_template: str
    subject_min_length: int = Field(ge=1)


class CommitPolicyDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["commit_policy"]
    conventional_commit: ConventionalCommitRules
    validation: ValidationRules
