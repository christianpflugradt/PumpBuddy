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
ARTIFACT_FORMATTER="agent/scripts/check/format-yaml-artifact.py"
ARTIFACT_VALIDATOR="agent/scripts/check/validate-artifact.py"
COMMON_REVIEW_ITEM_PLANNING_GUIDANCE="When drafting each proposed_backlog_item, decide if a plan is required. Set plan_item_required=true for non-trivial or cross-boundary work. Set plan_item_required=false for trivial/low-coupling work (for example doc enrichment, isolated renderer-only tweaks without API/database changes, or narrow low-risk bug fixes), and provide plan_item_skip_reason when false."
COMMON_REVIEW_VALIDATION_GUIDANCE="Format then validate the findings artifact before finalize with: python3 ${ARTIFACT_FORMATTER} extended-review-findings agent/tmp/${TASK_NAME}-findings.yaml && python3 ${ARTIFACT_VALIDATOR} extended-review-findings agent/tmp/${TASK_NAME}-findings.yaml. Keep scalar text fields as YAML strings, not lists/objects; quote text containing ': ' or backticks, or use block scalars."
COMMON_REVIEW_WRAP_UP="Before ending the first review turn, summarize findings for the stakeholder with stable display IDs F01..FN and priorities, then invite them to ask for the first finding in simple language. Use the tmp findings YAML as short-term memory for the follow-up walkthrough. Present findings one by one when the stakeholder asks for next/continue or similar wording. After all findings have been presented, ask which finding IDs to create backlog items for; accept free-text selections such as none, all, only F02 F03, or all but F01 F03. When selection is known, execute the finalize script with that quoted selection text. Treat the task output template as a required trailing status block, not as the full response body."

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
echo "FORMAT_WRITE_COMMAND=python3 ${ARTIFACT_FORMATTER} extended-review-findings agent/tmp/${TASK_NAME}-findings.yaml"
echo "VALIDATE_WRITE_COMMAND=python3 ${ARTIFACT_VALIDATOR} extended-review-findings agent/tmp/${TASK_NAME}-findings.yaml"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
BASE_INSTRUCTION="$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
echo "INSTRUCTION=${BASE_INSTRUCTION} ${COMMON_REVIEW_ITEM_PLANNING_GUIDANCE} ${COMMON_REVIEW_VALIDATION_GUIDANCE} ${COMMON_REVIEW_WRAP_UP}"
