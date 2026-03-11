#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
manifest_path="$repo_root/backend/Cargo.toml"
report_path="$repo_root/backend/target/llvm-cov/backend-coverage-summary.json"
minimum_branch_coverage="${BACKEND_BRANCH_COVERAGE_MIN:-40}"

find_llvm_tool() {
  local tool_name="$1"

  if command -v rustup >/dev/null 2>&1; then
    for toolchain in "${RUSTUP_TOOLCHAIN:-}" stable nightly; do
      if [[ -n "$toolchain" ]] && rustup which --toolchain "$toolchain" "$tool_name" >/dev/null 2>&1; then
        rustup which --toolchain "$toolchain" "$tool_name"
        return 0
      fi
    done
  fi

  for prefix in /opt/homebrew/opt/llvm/bin /usr/local/opt/llvm/bin; do
    if [[ -x "$prefix/$tool_name" ]]; then
      printf '%s\n' "$prefix/$tool_name"
      return 0
    fi
  done

  return 1
}

if [[ -z "${LLVM_COV:-}" ]]; then
  LLVM_COV="$(find_llvm_tool llvm-cov)" || {
    echo "backend coverage requires llvm-cov; install llvm-tools-preview via rustup or provide LLVM_COV." >&2
    exit 1
  }
  export LLVM_COV
fi

if [[ -z "${LLVM_PROFDATA:-}" ]]; then
  LLVM_PROFDATA="$(find_llvm_tool llvm-profdata)" || {
    echo "backend coverage requires llvm-profdata; install llvm-tools-preview via rustup or provide LLVM_PROFDATA." >&2
    exit 1
  }
  export LLVM_PROFDATA
fi

mkdir -p "$(dirname "$report_path")"

if ! rustc --version 2>/dev/null | grep -q "nightly"; then
  export RUSTC_BOOTSTRAP="${RUSTC_BOOTSTRAP:-1}"
fi

cargo llvm-cov \
  --manifest-path "$manifest_path" \
  --branch \
  --json \
  --summary-only \
  --output-path "$report_path"

python3 - "$report_path" "$minimum_branch_coverage" <<'PY'
import json
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
minimum = float(sys.argv[2])
payload = json.loads(report_path.read_text())

totals = payload.get("data", [{}])[0].get("totals", {})
branches = totals.get("branches")

if not isinstance(branches, dict):
    print("backend coverage report does not contain branch totals", file=sys.stderr)
    sys.exit(1)

covered = branches.get("covered")
count = branches.get("count")
percent = branches.get("percent")

if percent is None and covered is not None and count:
    percent = covered / count * 100

if percent is None:
    print("backend coverage report does not contain branch coverage percent", file=sys.stderr)
    sys.exit(1)

print(f"Backend branch coverage: {percent:.2f}% ({covered}/{count})")

if percent < minimum:
    print(
        f"Backend branch coverage {percent:.2f}% is below required minimum {minimum:.2f}%",
        file=sys.stderr,
    )
    sys.exit(1)
PY
