#!/usr/bin/env python3
"""Write one count metric as JSON for the Statistics workflow to publish."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 5:
        print("Usage: tools/write-count-metric.py <output-path> <label> <count> <kind>", file=sys.stderr)
        return 2

    output_path = Path(sys.argv[1])
    payload = {"id": output_path.stem, "label": sys.argv[2], "value": int(sys.argv[3]), "kind": sys.argv[4], "badge": True}

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
