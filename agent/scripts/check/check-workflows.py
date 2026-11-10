"""Retain actionlint checks while accepting GitHub's supported queue syntax."""
from pathlib import Path
import subprocess

import yaml


# actionlint 1.7.12 predates concurrency.queue. Validate that single extension
# explicitly; all remaining syntax, expression and shell checks stay enabled.
# https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
for path in Path(".github/workflows").glob("*.y*ml"):
    workflow = yaml.safe_load(path.read_text())
    scopes = [workflow, *workflow.get("jobs", {}).values()]
    for scope in scopes:
        concurrency = scope.get("concurrency")
        if isinstance(concurrency, dict) and "queue" in concurrency:
            if concurrency["queue"] not in ("single", "max"):
                raise ValueError(f"Invalid concurrency.queue in {path}")
            if concurrency["queue"] == "max" and concurrency.get("cancel-in-progress", False) is not False:
                raise ValueError(f"queue: max requires cancel-in-progress: false in {path}")

subprocess.run([
    "actionlint", "-ignore", '^unexpected key "queue" for "concurrency" section\\.',
], check=True)
