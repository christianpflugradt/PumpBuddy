#!/usr/bin/env python3
"""Write one coverage metric as JSON for the Statistics workflow to publish."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 4:
        print(
            "Usage: agent/scripts/write-coverage-metric.py <output-path> <label> <percent> [metric] [scope]",
            file=sys.stderr,
        )
        return 2

    output_path = Path(sys.argv[1])
    label = sys.argv[2]

    try:
        value = round(float(sys.argv[3]), 2)
    except ValueError:
        value = None

    payload = {"id": output_path.stem, "label": label, "value": value, "kind": "percent", "badge": True}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
