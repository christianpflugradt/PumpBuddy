#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def coverage_color(percent: float) -> str:
    if percent >= 90.0:
        return "brightgreen"
    if percent >= 75.0:
        return "green"
    if percent >= 60.0:
        return "yellowgreen"
    if percent >= 40.0:
        return "yellow"
    return "red"


def main() -> int:
    if len(sys.argv) < 4:
        print(
            "Usage: agent/scripts/write-coverage-badge.py <output-path> <label> <percent> [metric] [scope]",
            file=sys.stderr,
        )
        return 2

    output_path = Path(sys.argv[1])
    label = sys.argv[2]
    percent_raw = sys.argv[3]

    try:
        percent = float(percent_raw)
        message = f"{percent:.2f}%"
        color = coverage_color(percent)
    except ValueError:
        message = str(percent_raw)
        color = "lightgrey"

    payload = {
        "schemaVersion": 1,
        "label": label,
        "message": message,
        "color": color,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
