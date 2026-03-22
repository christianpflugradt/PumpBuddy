#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/refine-plan.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

ensure_context_runtime "${CONTEXT_CONFIG}" "${CONTEXT_LOADER}"
PLAN_ID_WIDTH="$(execution_plan_id_width "agent/execution/execution-config.yaml")"
ITEM_ID_WIDTH="$(execution_item_id_width "agent/execution/execution-config.yaml")"

cat <<'OUT'
TASK=refine-plan
OUT

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"

echo "PLAN_ID_WIDTH=${PLAN_ID_WIDTH}"
echo "ITEM_ID_WIDTH=${ITEM_ID_WIDTH}"

echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
