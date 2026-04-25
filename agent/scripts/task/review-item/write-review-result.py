#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ModuleNotFoundError:
    repo_root = Path(__file__).resolve().parents[4]
    venv_candidates = (
        repo_root / ".venv" / "bin" / "python3",
        repo_root / ".venv" / "bin" / "python",
    )
    for candidate in venv_candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK) and Path(sys.executable) != candidate:
            os.execv(str(candidate), [str(candidate), __file__, *sys.argv[1:]])
    raise


def parse_yaml(path: Path) -> Any:
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SystemExit(f"Invalid YAML in {path}: {exc}") from exc


def resolve_item_path(item_input: str) -> Path:
    candidate = Path(item_input)
    if candidate.is_file():
        return candidate

    if item_input.isdigit():
        for prefix in ("review", "done", "open"):
            p = Path(f"agent/execution/items/{prefix}-item-{item_input}.yaml")
            if p.is_file():
                return p
        raise SystemExit(
            f"Could not resolve item id {item_input} to a file in agent/execution/items."
        )

    raise SystemExit(
        "item-input must be an existing file path or numeric item id (for example 03)."
    )


def normalize_text(value: str) -> str:
    text = value.strip()
    if not text:
        raise SystemExit("All text fields must be non-empty.")
    return text


def parse_finding_compact(raw: str) -> dict[str, str]:
    parts = [part.strip() for part in raw.split("|||")]
    if len(parts) != 3 or any(not part for part in parts):
        raise SystemExit(
            "Each --finding must use 'criterion|||evidence|||risk' with non-empty parts."
        )
    return {"criterion": parts[0], "evidence": parts[1], "risk": parts[2]}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Write review_result safely without hand-editing YAML structures."
    )
    parser.add_argument("item_input", help="Review item path or numeric item id")
    parser.add_argument("outcome", choices=("accept", "return"))
    parser.add_argument("--criteria-met")
    parser.add_argument("--evidence")
    parser.add_argument("--runtime-build-check")
    parser.add_argument("--residual-risk")
    parser.add_argument(
        "--finding",
        action="append",
        default=[],
        help="Format: criterion|||evidence|||risk. Repeat for multiple findings.",
    )
    parser.add_argument(
        "--findings-file",
        help="Optional YAML/JSON file containing findings list with criterion/evidence/risk fields.",
    )
    args = parser.parse_args()

    item_path = resolve_item_path(args.item_input)
    data = parse_yaml(item_path) or {}
    if not isinstance(data, dict):
        raise SystemExit(f"Expected YAML object at document root in {item_path}")

    if args.outcome == "accept":
        required_fields = (
            ("--criteria-met", args.criteria_met),
            ("--evidence", args.evidence),
            ("--runtime-build-check", args.runtime_build_check),
            ("--residual-risk", args.residual_risk),
        )
        missing = [name for name, value in required_fields if not isinstance(value, str) or not value.strip()]
        if missing:
            raise SystemExit(f"Missing required arguments for accept outcome: {', '.join(missing)}")

        data["review_result"] = {
            "outcome": "accept",
            "acceptance": {
                "criteria_met": normalize_text(args.criteria_met or ""),
                "evidence": normalize_text(args.evidence or ""),
                "runtime_build_check": normalize_text(args.runtime_build_check or ""),
                "residual_risk": normalize_text(args.residual_risk or ""),
            },
            "findings": [],
        }
    else:
        findings: list[dict[str, str]] = [parse_finding_compact(raw) for raw in args.finding]
        if args.findings_file:
            extra = parse_yaml(Path(args.findings_file))
            raw_findings = extra.get("findings", extra) if isinstance(extra, dict) else extra
            if not isinstance(raw_findings, list):
                raise SystemExit("--findings-file must contain a list or an object with a findings list.")
            for idx, entry in enumerate(raw_findings, start=1):
                if not isinstance(entry, dict):
                    raise SystemExit(f"--findings-file entry {idx} must be an object.")
                criterion = normalize_text(str(entry.get("criterion", "")))
                evidence = normalize_text(str(entry.get("evidence", "")))
                risk = normalize_text(str(entry.get("risk", "")))
                findings.append({"criterion": criterion, "evidence": evidence, "risk": risk})

        if not findings:
            raise SystemExit("Return outcome requires at least one finding (--finding or --findings-file).")

        data["review_result"] = {"outcome": "return", "findings": findings, "acceptance": None}

    item_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
    print(f"WROTE review_result ({args.outcome}) to {item_path}")


if __name__ == "__main__":
    main()
