#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/finalize-plan.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"
ITEMS_DIR="agent/execution/items"

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

DONE_ITEMS="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'done-item-*.yaml' | sort || true)"
OPEN_COUNT="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'open-item-*.yaml' | wc -l | tr -d ' ')"
REVIEW_COUNT="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'review-item-*.yaml' | wc -l | tr -d ' ')"
DONE_COUNT="$(printf '%s\n' "${DONE_ITEMS}" | sed '/^$/d' | wc -l | tr -d ' ')"

if [ "${DONE_COUNT}" -lt 1 ]; then
  echo "Finalize blocked: at least one done item is required." >&2
  exit 30
fi

if [ "${OPEN_COUNT}" -ne 0 ] || [ "${REVIEW_COUNT}" -ne 0 ]; then
  echo "Finalize blocked: open or review items still exist." >&2
  exit 31
fi

cat <<'OUT'
TASK=finalize-plan
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

printf '%s\n' "${DONE_ITEMS}" | while IFS= read -r item_path; do
  [ -n "${item_path}" ] || continue
  require_file "${item_path}"
done

echo "WRITE=agent/tmp/finalize-plan-accept.md"
echo "WRITE=agent/tmp/finalize-plan-findings.yaml"
echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
