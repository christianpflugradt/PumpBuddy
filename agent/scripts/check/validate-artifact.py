#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

from validation.models.template_extended_review_findings import (
    ExtendedReviewFindingsTemplateDoc,
)
from validation.models.template_finalize_return_findings import FinalizeReturnFindingsDoc
from validation.models.template_item_template import BacklogItemTemplateDoc


def load_yaml(path: Path) -> Any:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SystemExit(
            f"FAIL invalid YAML in {path}: {exc}\n"
            "Hint: use plain strings for scalar fields and avoid YAML list syntax for string-only fields."
        ) from exc


def ensure_non_empty_string(value: Any, key: str, path: Path) -> None:
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"FAIL {key} must be a non-empty string in {path}")


def validate_review_item(path: Path) -> None:
    data = load_yaml(path) or {}
    try:
        BacklogItemTemplateDoc.model_validate(data)
    except Exception as exc:
        raise SystemExit(f"FAIL backlog item schema validation failed for {path}: {exc}") from exc

    review_result = data.get("review_result")
    if not isinstance(review_result, dict):
        raise SystemExit(f"FAIL review_result must be an object in {path}")

    outcome = review_result.get("outcome")
    if outcome not in {"accept", "return"}:
        raise SystemExit(f"FAIL review_result.outcome must be accept|return in {path}")

    if outcome == "accept":
        acceptance = review_result.get("acceptance")
        if not isinstance(acceptance, dict):
            raise SystemExit(f"FAIL review_result.acceptance must be an object in {path}")
        for key in ("criteria_met", "evidence", "runtime_build_check", "residual_risk"):
            ensure_non_empty_string(acceptance.get(key), f"review_result.acceptance.{key}", path)
        return

    findings = review_result.get("findings")
    if not isinstance(findings, list) or len(findings) < 1:
        raise SystemExit(f"FAIL review_result.findings must be a non-empty list in {path}")
    for idx, finding in enumerate(findings, start=1):
        if not isinstance(finding, dict):
            raise SystemExit(f"FAIL review_result.findings[{idx}] must be an object in {path}")
        for key in ("criterion", "evidence", "risk"):
            ensure_non_empty_string(
                finding.get(key),
                f"review_result.findings[{idx}].{key}",
                path,
            )


def validate_extended_review(path: Path) -> None:
    data = load_yaml(path) or {}
    try:
        ExtendedReviewFindingsTemplateDoc.model_validate(data)
    except Exception as exc:
        raise SystemExit(
            f"FAIL extended-review findings validation failed for {path}: {exc}"
        ) from exc


def validate_finalize_return(path: Path) -> None:
    data = load_yaml(path) or {}
    try:
        FinalizeReturnFindingsDoc.model_validate(data)
    except Exception as exc:
        raise SystemExit(
            f"FAIL finalize-return findings validation failed for {path}: {exc}"
        ) from exc


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate execution artifacts before finalize.")
    parser.add_argument(
        "artifact_type",
        choices=("review-item", "extended-review-findings", "finalize-return-findings"),
    )
    parser.add_argument("path")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        raise SystemExit(f"FAIL artifact file not found: {path}")
    if not path.is_file():
        raise SystemExit(f"FAIL artifact path is not a file: {path}")

    if args.artifact_type == "review-item":
        validate_review_item(path)
    elif args.artifact_type == "extended-review-findings":
        validate_extended_review(path)
    else:
        validate_finalize_return(path)

    print(f"PASS {args.artifact_type} validation: {path}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback for shell users
        print(f"FAIL unexpected validation error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
