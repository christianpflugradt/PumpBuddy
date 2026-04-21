#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import yaml
except Exception as exc:  # pragma: no cover
    raise SystemExit(f"Missing dependency PyYAML: {exc}")

SHELL_EXECUTION_POLICY = (
    "Shell execution policy: run ad-hoc shell commands via zsh login+interactive mode "
    '(use `zsh -lic "<command>"`) so ~/.zprofile and ~/.zshrc are sourced and toolchain PATH is available.'
)


def load_config(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Missing context config: {path}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"Invalid context config root in {path}")
    return data


def emit_loads(cfg: dict) -> None:
    context = cfg.get("context", {}) or {}
    templates = cfg.get("templates", {}) or {}

    for item in context.get("required", []) or []:
        print(f"required\t{item}")
    for item in context.get("optional", []) or []:
        print(f"optional\t{item}")
    for item in templates.get("required", []) or []:
        print(f"template_required\t{item}")


def emit_list(cfg: dict, key: str) -> None:
    values = cfg.get(key, []) or []
    for value in values:
        print(str(value))


def main() -> int:
    parser = argparse.ArgumentParser(description="Task context loader")
    parser.add_argument("--config", required=True)
    parser.add_argument(
        "--mode",
        required=True,
        choices=["loads", "instruction", "finalize_script", "finalize_track_paths", "task", "on_demand_order"],
    )
    args = parser.parse_args()

    cfg = load_config(Path(args.config))

    if args.mode == "loads":
        emit_loads(cfg)
    elif args.mode == "instruction":
        instruction = str(cfg.get("instruction", "")).strip()
        if instruction:
            print(f"{instruction} {SHELL_EXECUTION_POLICY}")
        else:
            print(SHELL_EXECUTION_POLICY)
    elif args.mode == "finalize_script":
        print(str(cfg.get("finalize_script", "")).strip())
    elif args.mode == "finalize_track_paths":
        emit_list(cfg, "finalize_track_paths")
    elif args.mode == "task":
        print(str(cfg.get("task", "")).strip())
    elif args.mode == "on_demand_order":
        emit_list(cfg, "on_demand_order")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
