#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/implement-item.yaml"
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

OPEN_ITEMS="$(find agent/execution -maxdepth 1 -type f -name 'open-item-*.yaml' | sort || true)"
if [ -z "${OPEN_ITEMS}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM="$(printf '%s\n' "${OPEN_ITEMS}" | head -n 1)"
ITEM_BASE="$(basename "${ITEM}")"
ITEM_ID="$(printf '%s' "${ITEM_BASE}" | sed -n 's/^open-item-\([0-9][0-9]\)\.yaml$/\1/p')"
if [ -z "${ITEM_ID}" ]; then
  echo "Unsupported open item filename: ${ITEM_BASE}" >&2
  exit 11
fi

PLAN_PATH="agent/execution/plans/plan-item-${ITEM_ID}.yaml"
if [ ! -f "${PLAN_PATH}" ]; then
  echo "Missing mandatory item plan for ${ITEM_BASE}: ${PLAN_PATH}" >&2
  exit 12
fi

cat <<'OUT'
TASK=implement-item
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

while IFS= read -r line; do
  case "${line}" in
    LOAD_REQUIRED=*)
      p="${line#LOAD_REQUIRED=}"
      require_file "${p}"
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

echo "WRITE=agent/tmp/implement-item-commit-message.txt"
echo "FINALIZE_SCRIPT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode finalize_script)"
echo "ON_DEMAND_CONTEXT=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode on_demand_order | paste -sd',' -)"
echo "INSTRUCTION=$(${CONTEXT_LOADER} --config "${CONTEXT_CONFIG}" --mode instruction)"
