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

ensure_context_runtime "${CONTEXT_CONFIG}" "${CONTEXT_LOADER}"
ITEM_ID_WIDTH="$(execution_item_id_width "agent/execution/execution-config.yaml")"

OPEN_ITEMS="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'open-item-*.yaml' | sort || true)"
if [ -z "${OPEN_ITEMS}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM=""
while IFS= read -r candidate; do
  [ -n "${candidate}" ] || continue
  base="$(basename "${candidate}")"
  item_num="$(printf '%s' "${base}" | sed -nE "s/^open-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
  [ -n "${item_num}" ] || continue
  candidate_plan="agent/execution/plans/plan-item-${item_num}.yaml"
  if [ ! -f "${candidate_plan}" ]; then
    needs_plan="$(python3 - "${candidate}" <<'PY'
import sys
from pathlib import Path

import yaml

item_path = Path(sys.argv[1])
data = yaml.safe_load(item_path.read_text(encoding="utf-8")) or {}
execution = data.get("execution") or {}
plan_required = execution.get("plan_item_required", True)
print("true" if plan_required is True else "false")
PY
)"
    if [ "${needs_plan}" = "true" ]; then
      ITEM="${candidate}"
      break
    fi
  fi
done <<EOF
${OPEN_ITEMS}
EOF

if [ -z "${ITEM}" ]; then
  echo "No unplanned open item requiring a plan found." >&2
  exit 13
fi

ITEM_BASE="$(basename "${ITEM}")"
ITEM_NUM="$(printf '%s' "${ITEM_BASE}" | sed -nE "s/^open-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
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
echo "ITEM_ID=${ITEM_NUM}"
echo "ITEM_ID_WIDTH=${ITEM_ID_WIDTH}"

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"

require_file "${ITEM}"
echo "WRITE=${PLAN_PATH}"

echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
