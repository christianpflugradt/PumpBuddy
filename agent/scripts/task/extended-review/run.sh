#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: agent/scripts/task/extended-review/run.sh <task-name> <context-config>" >&2
  exit 2
fi

TASK_NAME="$1"
CONTEXT_CONFIG="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"
WORKFLOW_STATE="agent/execution/workflow-state.yaml"
PLAN_FILE="agent/execution/plan.yaml"
ITEMS_DIR="agent/execution/items"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

ensure_context_runtime "${CONTEXT_CONFIG}" "${CONTEXT_LOADER}"

if [ ! -f "${WORKFLOW_STATE}" ] || [ ! -f "${PLAN_FILE}" ]; then
  echo "Extended review requires active plan state files." >&2
  exit 23
fi

DONE_COUNT="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'done-item-*.yaml' | wc -l | tr -d ' ')"
if [ "${DONE_COUNT}" -lt 1 ]; then
  echo "Extended review blocked: at least one done item is required in active plan." >&2
  exit 30
fi

python3 - "${WORKFLOW_STATE}" "${PLAN_FILE}" <<'PY'
import sys
from pathlib import Path

import yaml

state_path = Path(sys.argv[1])
plan_path = Path(sys.argv[2])
state = yaml.safe_load(state_path.read_text(encoding="utf-8")) or {}
plan = yaml.safe_load(plan_path.read_text(encoding="utf-8")) or {}
phase = ((state.get("current") or {}).get("phase"))
active_id = ((state.get("current") or {}).get("active_plan_id"))
plan_id = plan.get("id")
if phase == "finalized":
    raise SystemExit("Extended review blocked: workflow state is finalized.")
if not isinstance(plan_id, str) or not plan_id.startswith("pb-"):
    raise SystemExit("Extended review blocked: plan id is missing or invalid.")
if active_id not in (None, plan_id):
    raise SystemExit(f"Extended review blocked: active_plan_id ({active_id}) does not match plan id ({plan_id}).")
PY

cat <<OUT
TASK=${TASK_NAME}
OUT

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"

find "${ITEMS_DIR}" -maxdepth 1 -type f \( -name 'open-item-*.yaml' -o -name 'review-item-*.yaml' -o -name 'done-item-*.yaml' \) | sort | while IFS= read -r path; do
  [ -n "${path}" ] && require_file "${path}"
done

echo "WRITE=agent/tmp/${TASK_NAME}-findings.yaml"
echo "FINALIZE_SCRIPT=agent/scripts/task/extended-review/finalize.sh"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
