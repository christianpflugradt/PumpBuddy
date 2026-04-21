#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/implement-item.yaml"
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

ITEM="$(printf '%s\n' "${OPEN_ITEMS}" | head -n 1)"
ITEM_BASE="$(basename "${ITEM}")"
ITEM_ID="$(printf '%s' "${ITEM_BASE}" | sed -nE "s/^open-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
if [ -z "${ITEM_ID}" ]; then
  echo "Unsupported open item filename: ${ITEM_BASE}" >&2
  exit 11
fi

PLAN_REQUIRED="$(python3 - "${ITEM}" <<'PY'
import sys
from pathlib import Path

import yaml

item_path = Path(sys.argv[1])
data = yaml.safe_load(item_path.read_text(encoding="utf-8")) or {}
execution = data.get("execution") or {}
plan_required = execution.get("plan_item_required", True)
print("true" if bool(plan_required) else "false")
PY
)"

PLAN_PATH="agent/execution/plans/plan-item-${ITEM_ID}.yaml"
if [ "${PLAN_REQUIRED}" = "true" ] && [ ! -f "${PLAN_PATH}" ]; then
  echo "Missing mandatory item plan for ${ITEM_BASE}: ${PLAN_PATH}" >&2
  exit 12
fi
PLAN_AVAILABLE="false"
if [ -f "${PLAN_PATH}" ]; then
  PLAN_AVAILABLE="true"
fi

cat <<'OUT'
TASK=implement-item
OUT

echo "ITEM=${ITEM}"
echo "ITEM_ID=${ITEM_ID}"
echo "PLAN_ITEM_REQUIRED=${PLAN_REQUIRED}"
echo "PLAN_ITEM_AVAILABLE=${PLAN_AVAILABLE}"
if [ "${PLAN_AVAILABLE}" = "true" ]; then
  echo "PLAN_PATH=${PLAN_PATH}"
fi

emit_context_loads "${CONTEXT_LOADER}" "${CONTEXT_CONFIG}"

require_file "${ITEM}"
if [ "${PLAN_AVAILABLE}" = "true" ]; then
  require_file "${PLAN_PATH}"
fi

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

ITEM_CONTEXT_LINES="$(emit_context_lines "${ITEM}" "inputs")"
PLAN_CONTEXT_LINES=""
if [ "${PLAN_AVAILABLE}" = "true" ]; then
  PLAN_CONTEXT_LINES="$(emit_context_lines "${PLAN_PATH}" "context")"
fi

while IFS= read -r line; do
  case "${line}" in
    LOAD_REQUIRED=*)
      p="${line#LOAD_REQUIRED=}"
      resolved="$(resolve_status_aware_item_path "${p}" "${ITEM_ID_WIDTH}")"
      require_file "${resolved}"
      ;;
    LOAD_OPTIONAL=*)
      p="${line#LOAD_OPTIONAL=}"
      resolved="$(resolve_status_aware_item_path "${p}" "${ITEM_ID_WIDTH}")"
      emit_optional_load "${resolved}"
      ;;
  esac
done <<EOF
${ITEM_CONTEXT_LINES}
${PLAN_CONTEXT_LINES}
EOF

echo "WRITE=agent/tmp/implement-item-commit-message.txt"
echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
