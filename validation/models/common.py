from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Formatting(StrictModel):
    indent_spaces: int = Field(ge=2, le=4)


class References(StrictModel):
    model_config = ConfigDict(extra="allow")
