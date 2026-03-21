#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/discuss-plan.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

if [ ! -f "${CONTEXT_CONFIG}" ]; then
  echo "Missing context config: ${CONTEXT_CONFIG}" >&2
  exit 21
fi

if [ ! -x "${CONTEXT_LOADER}" ]; then
  echo "Missing context loader: ${CONTEXT_LOADER}" >&2
  exit 22
fi

cat <<'OUT'
TASK=discuss-plan
OUT

"${CONTEXT_LOADER}" --config "${CONTEXT_CONFIG}" --mode loads | while IFS="$(printf '\t')" read -r kind path; do
  case "${kind}" in
    required|template_required)
      require_file "${path}"
      ;;
    optional)
      emit_optional_load "${path}"
      ;;
  esac
done

CURRENT_PLAN_ID="$(extract_plan_id_yaml "agent/execution/plan.yaml" || true)"
case "${CURRENT_PLAN_ID}" in
  pb-[0-9]*)
    echo "PLAN_ID=${CURRENT_PLAN_ID}"
    ;;
  *)
    echo "Invalid or missing deterministic plan id in agent/execution/plan.yaml (expected pb-<number>)." >&2
    exit 23
    ;;
esac

echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"

echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
