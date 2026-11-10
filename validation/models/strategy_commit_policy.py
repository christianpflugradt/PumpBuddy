from __future__ import annotations

from typing import Literal

from .common import StrictModel


class CommitPolicyDoc(StrictModel):
    version: Literal[1]
    source_of_truth: Literal["commit_policy"]
    governance_config: Literal[".please/config.toml"]
    scopes_file: Literal[".please/commit-scopes.txt"]
    release_config: Literal["release.config.mjs"]
