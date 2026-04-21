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
COMMON_REVIEW_ITEM_PLANNING_GUIDANCE="When drafting each proposed_backlog_item, decide if a plan is required. Set plan_item_required=true for non-trivial or cross-boundary work. Set plan_item_required=false for trivial/low-coupling work (for example doc enrichment, isolated renderer-only tweaks without API/database changes, or narrow low-risk bug fixes), and provide plan_item_skip_reason when false."
COMMON_REVIEW_WRAP_UP="Before ending, summarize findings for the stakeholder and ask which backlog selection mode to apply (none, all, only-p0..only-p3, through-p0..through-p3). Treat the task output template as a required trailing status block, not as the full response body."

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

ensure_context_runtime "${CONTEXT_CONFIG}" "${CONTEXT_LOADER}"

cat <<OUT
TASK=${TASK_NAME}
OUT

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"
echo "SCOPE=workspace"
echo "WRITE=agent/tmp/${TASK_NAME}-findings.yaml"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
BASE_INSTRUCTION="$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
echo "INSTRUCTION=${BASE_INSTRUCTION} ${COMMON_REVIEW_ITEM_PLANNING_GUIDANCE} ${COMMON_REVIEW_WRAP_UP}"
