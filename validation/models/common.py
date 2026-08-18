from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Formatting(StrictModel):
    indent_spaces: int = Field(ge=2, le=4)


def validate_repo_relative_path(value: str) -> str:
    if not isinstance(value, str):
        raise TypeError("path reference must be a string")

    normalized = value.strip().replace("\\", "/")
    if not normalized:
        raise ValueError("path reference must be a non-empty string")
    if normalized.startswith("/"):
        raise ValueError("path reference must be relative, not absolute")
    if re.match(r"^[A-Za-z]:[\\/]", value):
        raise ValueError("path reference must be relative, not absolute")

    path = PurePosixPath(normalized)
    if ".." in path.parts:
        raise ValueError("path reference must stay inside the repository")

    return normalized


RepoRelativePath = Annotated[str, AfterValidator(validate_repo_relative_path)]


class References(StrictModel):
    model_config = ConfigDict(extra="allow")

    @model_validator(mode="after")
    def validate_reference_paths(self) -> "References":
        for key, value in (self.model_extra or {}).items():
            try:
                validate_repo_relative_path(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"references.{key} {exc}") from exc
        return self


class ApprovedException(StrictModel):
    id: str
    boundary: str | None = None
    applies_to: list[str] | None = None
    allowance: str
    constraints: list[str]
    review_focus: list[str] | None = None
