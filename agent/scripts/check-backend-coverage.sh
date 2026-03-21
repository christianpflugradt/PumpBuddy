#!/usr/bin/env sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
manifest_path="$repo_root/backend/Cargo.toml"
badge_output_dir="${COVERAGE_BADGE_OUTPUT_DIR:-$repo_root/site/badges}"
badge_json_path="$badge_output_dir/backend-coverage.json"
threshold="${BACKEND_BRANCH_COVERAGE_MIN:-0}"

tmp_json="$(mktemp)"
trap 'rm -f "$tmp_json"' EXIT INT TERM

if command -v cargo-llvm-cov >/dev/null 2>&1; then
  if ! cargo llvm-cov --manifest-path "$manifest_path" --branch --json --output-path "$tmp_json"; then
    echo "WARN cargo-llvm-cov execution failed; falling back to cargo test and n/a badge." >&2
    cargo test --manifest-path "$manifest_path"
    python3 "$repo_root/agent/scripts/write-coverage-badge.py" \
      "$badge_json_path" \
      "backend branch coverage" \
      "n/a" \
      "branch" \
      "all files"
    exit 0
  fi
else
  echo "WARN cargo-llvm-cov not installed; falling back to cargo test and n/a badge." >&2
  cargo test --manifest-path "$manifest_path"
  python3 "$repo_root/agent/scripts/write-coverage-badge.py" \
    "$badge_json_path" \
    "backend branch coverage" \
    "n/a" \
    "branch" \
    "all files"
  exit 0
fi

coverage="$(
  python3 - "$tmp_json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))

paths = [
    ("data", 0, "totals", "branches", "percent"),
    ("data", 0, "totals", "branches", "pct"),
    ("totals", "branches", "percent"),
    ("totals", "branches", "pct"),
]

def get_value(node, path):
    cur = node
    for part in path:
        if isinstance(part, int):
            if not isinstance(cur, list) or len(cur) <= part:
                return None
            cur = cur[part]
        else:
            if not isinstance(cur, dict) or part not in cur:
                return None
            cur = cur[part]
    return cur

for path in paths:
    value = get_value(report, path)
    if isinstance(value, (int, float)):
        print(f"{float(value):.2f}")
        raise SystemExit(0)

print("n/a")
PY
)"

python3 "$repo_root/agent/scripts/write-coverage-badge.py" \
  "$badge_json_path" \
  "backend branch coverage" \
  "$coverage" \
  "branch" \
  "all files"

if [ "$coverage" = "n/a" ]; then
  echo "WARN could not parse backend branch coverage from llvm-cov output." >&2
  exit 0
fi

python3 - "$coverage" "$threshold" <<'PY'
import sys

coverage = float(sys.argv[1])
threshold = float(sys.argv[2])

print(f"Backend branch coverage: {coverage:.2f}% (threshold: {threshold:.2f}%)")
if coverage < threshold:
    print(
        f"Backend branch coverage {coverage:.2f}% is below required minimum {threshold:.2f}%",
        file=sys.stderr,
    )
    raise SystemExit(1)
PY
