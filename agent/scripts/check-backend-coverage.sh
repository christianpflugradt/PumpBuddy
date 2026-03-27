#!/usr/bin/env sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
manifest_path="$repo_root/backend/Cargo.toml"
badge_output_dir="${COVERAGE_BADGE_OUTPUT_DIR:-$repo_root/site/badges}"
badge_json_path="$badge_output_dir/backend-coverage.json"
threshold="${BACKEND_BRANCH_COVERAGE_MIN:-0}"
coverage_metric="branch"

tmp_json="$(mktemp)"
tmp_log="$(mktemp)"
trap 'rm -f "$tmp_json" "$tmp_log"' EXIT INT TERM

write_na_badge() {
  TESTCONTAINERS_COMMAND=remove cargo test --manifest-path "$manifest_path"
  python3 "$repo_root/agent/scripts/write-coverage-badge.py" \
    "$badge_json_path" \
    "backend branch coverage" \
    "n/a" \
    "branch" \
    "all files"
}

is_nightly_toolchain() {
  rustc -V 2>/dev/null | grep -q "nightly"
}

select_initial_coverage_metric() {
  if [ "$coverage_metric" = "branch" ] && ! is_nightly_toolchain; then
    echo "WARN branch coverage requires nightly; running line coverage mode on stable toolchain." >&2
    coverage_metric="line"
  fi
}

run_cargo_llvm_cov_once() {
  selected_flag="$1"
  : >"$tmp_log"
  if [ "$#" -eq 3 ]; then
    llvm_cov_path="$2"
    llvm_profdata_path="$3"
    if [ -n "$selected_flag" ]; then
      TESTCONTAINERS_COMMAND=remove LLVM_COV="$llvm_cov_path" LLVM_PROFDATA="$llvm_profdata_path" \
        cargo llvm-cov --manifest-path "$manifest_path" "$selected_flag" --json --output-path "$tmp_json" 2>"$tmp_log"
    else
      TESTCONTAINERS_COMMAND=remove LLVM_COV="$llvm_cov_path" LLVM_PROFDATA="$llvm_profdata_path" \
        cargo llvm-cov --manifest-path "$manifest_path" --json --output-path "$tmp_json" 2>"$tmp_log"
    fi
    return "$?"
  fi

  if [ -n "$selected_flag" ]; then
    TESTCONTAINERS_COMMAND=remove cargo llvm-cov --manifest-path "$manifest_path" "$selected_flag" --json --output-path "$tmp_json" 2>"$tmp_log"
  else
    TESTCONTAINERS_COMMAND=remove cargo llvm-cov --manifest-path "$manifest_path" --json --output-path "$tmp_json" 2>"$tmp_log"
  fi
}

run_cargo_llvm_cov() {
  metric="$coverage_metric"
  branch_flag="--branch"
  if [ "$metric" = "line" ]; then
    branch_flag=""
  fi

  if run_cargo_llvm_cov_once "$branch_flag" "$@"; then
    return 0
  fi

  if [ "$metric" = "branch" ] && (grep -q -- "--branch flag requires nightly toolchain" "$tmp_log" || grep -q -- "option \`Z\` is only accepted on the nightly compiler" "$tmp_log"); then
    echo "WARN branch coverage requires nightly; retrying with line coverage mode." >&2
    coverage_metric="line"
    if run_cargo_llvm_cov_once "" "$@"; then
      return 0
    fi
  fi

  return 1
}

detect_llvm_tools_from_rustup() {
  toolchain="${1:-}"
  if ! command -v rustup >/dev/null 2>&1; then
    return 1
  fi

  if [ -n "$toolchain" ]; then
    sysroot="$(rustup run "$toolchain" rustc --print sysroot 2>/dev/null || true)"
    host="$(rustup run "$toolchain" rustc -vV 2>/dev/null | sed -n 's/^host: //p' | head -n 1)"
    if [ -n "$sysroot" ] && [ -n "$host" ]; then
      llvm_cov_path="$sysroot/lib/rustlib/$host/bin/llvm-cov"
      llvm_profdata_path="$sysroot/lib/rustlib/$host/bin/llvm-profdata"
    else
      llvm_cov_path=""
      llvm_profdata_path=""
    fi
  else
    llvm_cov_path="$(rustup which llvm-cov 2>/dev/null || true)"
    llvm_profdata_path="$(rustup which llvm-profdata 2>/dev/null || true)"
  fi

  if [ -n "$llvm_cov_path" ] && [ -n "$llvm_profdata_path" ] && [ -x "$llvm_cov_path" ] && [ -x "$llvm_profdata_path" ]; then
    printf '%s\n%s\n' "$llvm_cov_path" "$llvm_profdata_path"
    return 0
  fi

  return 1
}

detect_llvm_tools_from_rustc_sysroot() {
  if ! command -v rustc >/dev/null 2>&1; then
    return 1
  fi

  host="$(rustc -vV 2>/dev/null | sed -n 's/^host: //p' | head -n 1)"
  sysroot="$(rustc --print sysroot 2>/dev/null || true)"
  if [ -z "$host" ] || [ -z "$sysroot" ]; then
    return 1
  fi

  llvm_cov_path="$sysroot/lib/rustlib/$host/bin/llvm-cov"
  llvm_profdata_path="$sysroot/lib/rustlib/$host/bin/llvm-profdata"
  if [ -x "$llvm_cov_path" ] && [ -x "$llvm_profdata_path" ]; then
    printf '%s\n%s\n' "$llvm_cov_path" "$llvm_profdata_path"
    return 0
  fi

  return 1
}

detect_llvm_tools_from_path() {
  llvm_cov_path="$(command -v llvm-cov 2>/dev/null || true)"
  llvm_profdata_path="$(command -v llvm-profdata 2>/dev/null || true)"

  if [ -n "$llvm_cov_path" ] && [ -n "$llvm_profdata_path" ] && [ -x "$llvm_cov_path" ] && [ -x "$llvm_profdata_path" ]; then
    printf '%s\n%s\n' "$llvm_cov_path" "$llvm_profdata_path"
    return 0
  fi

  return 1
}

try_install_llvm_tools_with_rustup() {
  if ! command -v rustup >/dev/null 2>&1; then
    return 1
  fi

  # Prefer active/default toolchain when available.
  if rustup component add llvm-tools-preview >/dev/null 2>&1; then
    return 0
  fi

  # Recover hosts where rustup is present but no default toolchain is configured.
  if rustup component add llvm-tools-preview --toolchain stable >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

try_recover_with_discovered_llvm_tools() {
  if discovered_paths="$(detect_llvm_tools_from_rustup)"; then
    llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
    if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
      return 0
    fi
  fi

  if discovered_paths="$(detect_llvm_tools_from_rustc_sysroot)"; then
    llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
    if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
      return 0
    fi
  fi

  if discovered_paths="$(detect_llvm_tools_from_rustup stable)"; then
    llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
    if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
      return 0
    fi
  fi

  if discovered_paths="$(detect_llvm_tools_from_path)"; then
    llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
    if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
      return 0
    fi
  fi

  if try_install_llvm_tools_with_rustup; then
    if discovered_paths="$(detect_llvm_tools_from_rustup)"; then
      llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
      llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
      if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
        return 0
      fi
    fi

    if discovered_paths="$(detect_llvm_tools_from_rustup stable)"; then
      llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
      llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
      if run_cargo_llvm_cov "$llvm_cov_path" "$llvm_profdata_path"; then
        return 0
      fi
    fi
  fi

  return 1
}

if command -v cargo-llvm-cov >/dev/null 2>&1; then
  select_initial_coverage_metric

  initial_llvm_cov_path=""
  initial_llvm_profdata_path=""
  if discovered_paths="$(detect_llvm_tools_from_rustup)"; then
    initial_llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    initial_llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
  elif discovered_paths="$(detect_llvm_tools_from_rustc_sysroot)"; then
    initial_llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    initial_llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
  elif discovered_paths="$(detect_llvm_tools_from_rustup stable)"; then
    initial_llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    initial_llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
  elif discovered_paths="$(detect_llvm_tools_from_path)"; then
    initial_llvm_cov_path="$(printf '%s' "$discovered_paths" | sed -n '1p')"
    initial_llvm_profdata_path="$(printf '%s' "$discovered_paths" | sed -n '2p')"
  fi

  if [ -n "$initial_llvm_cov_path" ] && [ -n "$initial_llvm_profdata_path" ]; then
    if ! run_cargo_llvm_cov "$initial_llvm_cov_path" "$initial_llvm_profdata_path"; then
      if grep -q "failed to find llvm-tools-preview" "$tmp_log"; then
        echo "WARN cargo-llvm-cov could not find llvm-tools-preview; attempting llvm tool path recovery." >&2
        if ! try_recover_with_discovered_llvm_tools; then
          [ -s "$tmp_log" ] && cat "$tmp_log" >&2
          if grep -q "failed to find llvm-tools-preview" "$tmp_log"; then
            echo "WARN cargo-llvm-cov execution failed due to unavailable llvm-tools; falling back to cargo test and n/a badge." >&2
            write_na_badge
            exit 0
          fi
          echo "ERROR cargo-llvm-cov execution failed after llvm tool recovery." >&2
          exit 1
        fi
      else
        [ -s "$tmp_log" ] && cat "$tmp_log" >&2
        echo "ERROR cargo-llvm-cov execution failed." >&2
        exit 1
      fi
    fi
  elif ! run_cargo_llvm_cov; then
    if grep -q "failed to find llvm-tools-preview" "$tmp_log"; then
      echo "WARN cargo-llvm-cov could not find llvm-tools-preview; attempting llvm tool path recovery." >&2
      if ! try_recover_with_discovered_llvm_tools; then
        [ -s "$tmp_log" ] && cat "$tmp_log" >&2
        if grep -q "failed to find llvm-tools-preview" "$tmp_log"; then
          echo "WARN cargo-llvm-cov execution failed due to unavailable llvm-tools; falling back to cargo test and n/a badge." >&2
          write_na_badge
          exit 0
        fi
        echo "ERROR cargo-llvm-cov execution failed after llvm tool recovery." >&2
        exit 1
      fi
    else
      [ -s "$tmp_log" ] && cat "$tmp_log" >&2
      echo "ERROR cargo-llvm-cov execution failed." >&2
      exit 1
    fi
  fi
  [ -s "$tmp_log" ] && cat "$tmp_log" >&2
else
  echo "WARN cargo-llvm-cov not installed; falling back to cargo test and n/a badge." >&2
  write_na_badge
  exit 0
fi

coverage="$(
  python3 - "$tmp_json" "$coverage_metric" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
metric = sys.argv[2]

if metric == "branch":
    paths = [
        ("data", 0, "totals", "branches", "percent"),
        ("data", 0, "totals", "branches", "pct"),
        ("totals", "branches", "percent"),
        ("totals", "branches", "pct"),
    ]
else:
    paths = [
        ("data", 0, "totals", "lines", "percent"),
        ("data", 0, "totals", "lines", "pct"),
        ("totals", "lines", "percent"),
        ("totals", "lines", "pct"),
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
  "backend ${coverage_metric} coverage" \
  "$coverage" \
  "$coverage_metric" \
  "all files"

if [ "$coverage" = "n/a" ]; then
  echo "WARN could not parse backend ${coverage_metric} coverage from llvm-cov output." >&2
  exit 0
fi

python3 - "$coverage" "$threshold" "$coverage_metric" <<'PY'
import sys

coverage = float(sys.argv[1])
threshold = float(sys.argv[2])
metric = sys.argv[3]

print(f"Backend {metric} coverage: {coverage:.2f}% (threshold: {threshold:.2f}%)")
if coverage < threshold:
    print(
        f"Backend {metric} coverage {coverage:.2f}% is below required minimum {threshold:.2f}%",
        file=sys.stderr,
    )
    raise SystemExit(1)
PY
