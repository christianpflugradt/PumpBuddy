from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict

from pydantic import ValidationError

from validation.core.checks import ValidationIssue, cross_file_checks
from validation.core.loader import load_yaml
from validation.models import MODEL_REGISTRY


def _validate_with_registry(
    path_mapping: Dict[str, str],
    label: str,
    with_cross_checks: bool,
) -> tuple[Dict[str, Any], list[ValidationIssue]]:
    validated_docs: Dict[str, Any] = {}
    issues: list[ValidationIssue] = []

    print(f"\nValidating {label}:")
    for model_key, target_path in path_mapping.items():
        path = Path(target_path)
        try:
            model_type = MODEL_REGISTRY[model_key]
            payload = load_yaml(path)
            validated_docs[model_key] = model_type.model_validate(payload)
            print(f"OK   {target_path}")
        except FileNotFoundError:
            issues.append(ValidationIssue(severity="error", message=f"missing file: {target_path}"))
        except (ValidationError, ValueError, TypeError, KeyError) as exc:
            issues.append(ValidationIssue(severity="error", message=f"invalid {target_path}: {exc}"))

    if with_cross_checks:
        issues.extend(cross_file_checks(validated_docs))

    return validated_docs, issues


def _example_path_mapping() -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for model_key in MODEL_REGISTRY:
        relative = Path(model_key).relative_to("agent")
        mapping[model_key] = (Path("validation/examples") / relative).as_posix()
    return mapping


def validate_files() -> int:
    _, doc_issues = _validate_with_registry(
        path_mapping={k: k for k in MODEL_REGISTRY},
        label="project documents",
        with_cross_checks=True,
    )
    _, example_issues = _validate_with_registry(
        path_mapping=_example_path_mapping(),
        label="example documents",
        with_cross_checks=False,
    )
    issues = doc_issues + example_issues

    error_count = 0
    warning_count = 0
    if issues:
        print("\nCross-file and schema findings:")
        for issue in issues:
            level = issue.severity.upper()
            print(f"- {level}: {issue.message}")
            if issue.severity == "error":
                error_count += 1
            else:
                warning_count += 1

    print(f"\nSummary: {error_count} errors, {warning_count} warnings")
    return 1 if issues else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate design and strategy YAML documents")
    parser.parse_args()
    return validate_files()


if __name__ == "__main__":
    sys.exit(main())
