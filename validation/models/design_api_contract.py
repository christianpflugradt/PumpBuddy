from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import field_validator, model_validator

from .common import StrictModel


class OpenApiInfo(StrictModel):
    title: str
    version: str
    description: Optional[str] = None


class ApiContractDoc(StrictModel):
    openapi: str
    info: OpenApiInfo
    paths: Dict[str, Dict[str, Any]]
    components: Dict[str, Any]

    @field_validator("openapi")
    @classmethod
    def validate_openapi_version(cls, value: str) -> str:
        if not value.startswith("3."):
            raise ValueError("openapi version must be 3.x")
        return value

    @model_validator(mode="after")
    def ensure_non_empty_paths(self) -> "ApiContractDoc":
        if not self.paths:
            raise ValueError("paths must not be empty")
        return self
