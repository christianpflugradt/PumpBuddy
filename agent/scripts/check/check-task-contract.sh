#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/check/check-task-contract.sh <task-name>" >&2
  exit 2
fi

TASK="$1"
SPEC_PATH="agent/execution/task-spec/${TASK}.yaml"
ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "${ROOT_DIR}"
export ROOT_DIR

COMMON_LIB="${ROOT_DIR}/agent/scripts/lib/common.sh"
if [ -f "${COMMON_LIB}" ]; then
  # shellcheck source=/dev/null
  . "${COMMON_LIB}"
fi

python3 - "$SPEC_PATH" <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception as exc:
    print(f"ERROR missing PyYAML: {exc}")
    raise SystemExit(1)

spec_path = Path(sys.argv[1])
if not spec_path.exists():
    print(f"ERROR missing task spec: {spec_path}")
    raise SystemExit(1)

spec = yaml.safe_load(spec_path.read_text(encoding="utf-8")) or {}
contract = spec.get("script_contract", {}) or {}
failures = []

for key in ["dispatcher_script", "task_script", "finalize_script", "context_config"]:
    value = contract.get(key)
    if not value:
        failures.append(f"missing script_contract.{key}")
        continue
    if not Path(value).exists():
        failures.append(f"path does not exist for {key}: {value}")

context_path = contract.get("context_config")
if context_path and Path(context_path).exists():
    ctx = yaml.safe_load(Path(context_path).read_text(encoding="utf-8")) or {}
    if ctx.get("task") != spec.get("task"):
        failures.append(
            f"task mismatch between spec ({spec.get('task')}) and context ({ctx.get('task')})"
        )

if failures:
    for item in failures:
        print(f"FAIL {item}")
    raise SystemExit(1)

print(f"PASS task contract ok: {spec.get('task')}")
PY
