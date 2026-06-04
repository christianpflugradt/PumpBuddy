#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Callable

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def reexec_with_repo_venv_if_available() -> None:
    venv_candidates = (
        REPO_ROOT / ".venv" / "bin" / "python3",
        REPO_ROOT / ".venv" / "bin" / "python",
    )
    current = Path(sys.executable)
    for candidate in venv_candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            if current != candidate:
                os.execv(str(candidate), [str(candidate), __file__, *sys.argv[1:]])


try:
    import yaml

    from validation.models.template_extended_review_findings import (
        ExtendedReviewFindingsTemplateDoc,
    )
    from validation.models.template_finalize_return_findings import (
        FinalizeReturnFindingsDoc,
    )
    from validation.models.template_item_template import BacklogItemTemplateDoc
    from validation.models.template_plan_item_template import PlanItemTemplateDoc
except ModuleNotFoundError:
    reexec_with_repo_venv_if_available()
    raise


ModelValidator = Callable[[Any], Any]

VALIDATORS: dict[str, ModelValidator] = {
    "backlog-item": BacklogItemTemplateDoc.model_validate,
    "review-item": BacklogItemTemplateDoc.model_validate,
    "item-plan": PlanItemTemplateDoc.model_validate,
    "extended-review-findings": ExtendedReviewFindingsTemplateDoc.model_validate,
    "finalize-return-findings": FinalizeReturnFindingsDoc.model_validate,
}

KIND_TO_ARTIFACT_TYPE = {
    "backlog_item": "backlog-item",
    "item_plan": "item-plan",
    "extended_review_findings": "extended-review-findings",
    "finalize_return_findings": "finalize-return-findings",
}


class ArtifactDumper(yaml.SafeDumper):
    pass


def represent_string(dumper: yaml.SafeDumper, data: str) -> yaml.nodes.ScalarNode:
    style = "'" if "`" in data or ": " in data else None
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style=style)


ArtifactDumper.add_representer(str, represent_string)


def load_yaml(path: Path) -> Any:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SystemExit(
            f"FAIL invalid YAML in {path}: {exc}\n"
            "Hint: quote scalar text containing ': ' or backticks, or use a block scalar."
        ) from exc


def resolve_artifact_type(requested_type: str, data: Any, path: Path) -> str:
    if requested_type != "auto":
        return requested_type

    if not isinstance(data, dict):
        raise SystemExit(f"FAIL expected YAML object at document root in {path}")

    kind = data.get("kind")
    if not isinstance(kind, str):
        raise SystemExit(f"FAIL cannot auto-detect artifact type without string kind in {path}")

    artifact_type = KIND_TO_ARTIFACT_TYPE.get(kind)
    if not artifact_type:
        raise SystemExit(f"FAIL unsupported artifact kind in {path}: {kind}")

    return artifact_type


def validate_artifact(artifact_type: str, data: Any, path: Path) -> None:
    validator = VALIDATORS[artifact_type]
    try:
        validator(data)
    except Exception as exc:
        raise SystemExit(f"FAIL {artifact_type} schema validation failed for {path}: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Parse, validate, and re-emit a YAML artifact with deterministic quoting for "
            "problematic scalar text."
        )
    )
    parser.add_argument(
        "artifact_type",
        choices=(
            "auto",
            "backlog-item",
            "review-item",
            "item-plan",
            "extended-review-findings",
            "finalize-return-findings",
        ),
    )
    parser.add_argument("path")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        raise SystemExit(f"FAIL artifact file not found: {path}")
    if not path.is_file():
        raise SystemExit(f"FAIL artifact path is not a file: {path}")

    data = load_yaml(path)
    artifact_type = resolve_artifact_type(args.artifact_type, data, path)
    validate_artifact(artifact_type, data, path)

    formatted = yaml.dump(data, Dumper=ArtifactDumper, sort_keys=False, allow_unicode=False)
    path.write_text(formatted, encoding="utf-8")
    print(f"FORMATTED {artifact_type}: {path}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"FAIL unexpected format error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
