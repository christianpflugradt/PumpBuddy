#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/plan-item.yaml"
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

OPEN_ITEMS="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'open-item-*.yaml' | sort || true)"
if [ -z "${OPEN_ITEMS}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM=""
while IFS= read -r candidate; do
  [ -n "${candidate}" ] || continue
  base="$(basename "${candidate}")"
  item_num="$(printf '%s' "${base}" | sed -n 's/^open-item-\([0-9][0-9]\)\.yaml$/\1/p')"
  [ -n "${item_num}" ] || continue
  candidate_plan="agent/execution/plans/plan-item-${item_num}.yaml"
  if [ ! -f "${candidate_plan}" ]; then
    ITEM="${candidate}"
    break
  fi
done <<EOF
${OPEN_ITEMS}
EOF

if [ -z "${ITEM}" ]; then
  echo "No unplanned open item found (all open items already have plan-item-XX.yaml)." >&2
  exit 13
fi

ITEM_BASE="$(basename "${ITEM}")"
ITEM_NUM="$(printf '%s' "${ITEM_BASE}" | sed -n 's/^open-item-\([0-9][0-9]\)\.yaml$/\1/p')"
if [ -z "${ITEM_NUM}" ]; then
  echo "Unsupported open item filename: ${ITEM_BASE}" >&2
  exit 11
fi

PLAN_DIR="agent/execution/plans"
PLAN_PATH="${PLAN_DIR}/plan-item-${ITEM_NUM}.yaml"

cat <<'OUT'
TASK=plan-item
OUT

echo "ITEM=${ITEM}"

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

require_file "${ITEM}"
echo "WRITE=${PLAN_PATH}"

echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
