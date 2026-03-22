#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/review-item.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"
ITEMS_DIR="agent/execution/items"
QUALITY_GATE_SCRIPT="agent/scripts/check/run-quality-gate.sh"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

ensure_context_runtime "${CONTEXT_CONFIG}" "${CONTEXT_LOADER}"
ITEM_ID_WIDTH="$(execution_item_id_width "agent/execution/execution-config.yaml")"

REVIEW_ITEMS="$(find "${ITEMS_DIR}" -maxdepth 1 -type f -name 'review-item-*.yaml' | sort || true)"
if [ -z "${REVIEW_ITEMS}" ]; then
  echo "No review item found." >&2
  exit 10
fi

ITEM="$(printf '%s\n' "${REVIEW_ITEMS}" | head -n 1)"
ITEM_BASE="$(basename "${ITEM}")"
ITEM_ID="$(printf '%s' "${ITEM_BASE}" | sed -nE "s/^review-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
if [ -z "${ITEM_ID}" ]; then
  echo "Unsupported review item filename: ${ITEM_BASE}" >&2
  exit 11
fi

PLAN_PATH="agent/execution/plans/plan-item-${ITEM_ID}.yaml"
if [ ! -f "${PLAN_PATH}" ]; then
  echo "Missing mandatory item plan for ${ITEM_BASE}: ${PLAN_PATH}" >&2
  exit 12
fi

cat <<'OUT'
TASK=review-item
OUT

echo "ITEM=${ITEM}"

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"

require_file "${ITEM}"
require_file "${PLAN_PATH}"

emit_context_lines() {
  yaml_path="$1"
  section="$2"
  python3 - "${yaml_path}" "${section}" <<'PY'
import sys
from pathlib import Path

try:
    import yaml
except Exception:
    raise SystemExit(0)

item_path = Path(sys.argv[1])
section = sys.argv[2]
try:
    data = yaml.safe_load(item_path.read_text(encoding="utf-8")) or {}
except Exception:
    raise SystemExit(0)

node = data.get(section, {}) or {}
required = node.get("required", []) or []
optional = node.get("optional", []) or []

for path in required:
    if isinstance(path, str):
        print(f"LOAD_REQUIRED={path}")
for path in optional:
    if isinstance(path, str):
        print(f"LOAD_OPTIONAL={path}")
PY
}

resolve_status_aware_required_path() {
  raw_path="$1"
  case "${raw_path}" in
    agent/execution/items/open-item-*.yaml)
      base="$(basename "${raw_path}")"
      item_num="$(printf '%s' "${base}" | sed -nE "s/^open-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
      if [ -n "${item_num}" ]; then
        open_path="agent/execution/items/open-item-${item_num}.yaml"
        review_path="agent/execution/items/review-item-${item_num}.yaml"
        done_path="agent/execution/items/done-item-${item_num}.yaml"
        if [ -f "${open_path}" ]; then
          printf '%s\n' "${open_path}"
          return 0
        fi
        if [ -f "${review_path}" ]; then
          printf '%s\n' "${review_path}"
          return 0
        fi
        if [ -f "${done_path}" ]; then
          printf '%s\n' "${done_path}"
          return 0
        fi
      fi
      ;;
  esac
  printf '%s\n' "${raw_path}"
}

while IFS= read -r line; do
  case "${line}" in
    LOAD_REQUIRED=*)
      p="${line#LOAD_REQUIRED=}"
      resolved="$(resolve_status_aware_required_path "${p}")"
      require_file "${resolved}"
      ;;
    LOAD_OPTIONAL=*)
      p="${line#LOAD_OPTIONAL=}"
      emit_optional_load "${p}"
      ;;
  esac
done <<EOF
$(emit_context_lines "${ITEM}" "inputs")
$(emit_context_lines "${PLAN_PATH}" "context")
EOF

echo "WRITE=${ITEM}"
echo "QUALITY_GATE_SCRIPT=${QUALITY_GATE_SCRIPT}"
echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
