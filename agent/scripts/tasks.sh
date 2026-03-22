#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/tasks.sh <task-name|alias|number>" >&2
  exit 2
fi

RAW_TASK="$1"
TASK="$(printf '%s' "${RAW_TASK}" | tr '[:upper:]' '[:lower:]')"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMON_LIB="${SCRIPT_DIR}/lib/common.sh"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"

if [ -f "${COMMON_LIB}" ]; then
  # shellcheck source=/dev/null
  . "${COMMON_LIB}"
fi

resolve_core_task_alias() {
  value="$1"
  case "${value}" in
    1|discuss|go|discuss-plan)
      printf '%s\n' "discuss-plan"
      ;;
    2|refine|split|refine-plan)
      printf '%s\n' "refine-plan"
      ;;
    3|plan|plan-item)
      printf '%s\n' "plan-item"
      ;;
    4|implement|do|implement-item)
      printf '%s\n' "implement-item"
      ;;
    5|review|see|review-item)
      printf '%s\n' "review-item"
      ;;
    6|finalize|end|finalize-plan)
      printf '%s\n' "finalize-plan"
      ;;
    7|review-arch|arch-review|review-architecture)
      printf '%s\n' "review-architecture"
      ;;
    8|review-consistency|consistency-review)
      printf '%s\n' "review-consistency"
      ;;
    9|review-quality|quality-review)
      printf '%s\n' "review-quality"
      ;;
    10|review-security|security-review)
      printf '%s\n' "review-security"
      ;;
    11|review-technology|technology-review|tech-review)
      printf '%s\n' "review-technology"
      ;;
    *)
      printf '%s\n' "${value}"
      ;;
  esac
}

TASK="$(resolve_core_task_alias "${TASK}")"
TASK_SCRIPT_V2="${SCRIPT_DIR}/task/${TASK}/run.sh"

if [ -f "${TASK_SCRIPT_V2}" ]; then
  TASK_SCRIPT="${TASK_SCRIPT_V2}"
else
  echo "Unknown task: ${TASK}" >&2
  exit 3
fi

DIRTY_WORKSPACE="$(git status --porcelain || true)"
if [ -n "${DIRTY_WORKSPACE}" ]; then
  echo "Task bootstrap aborted: workspace is not clean." >&2
  echo "Please commit/stash/discard pending changes before starting a task." >&2
  printf '%s\n' "${DIRTY_WORKSPACE}" >&2
  exit 40
fi

OUTPUT="$(${TASK_SCRIPT})"
printf '%s\n' "${OUTPUT}"

TASK_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^TASK=//p' | head -n 1)"
ITEM_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^ITEM=//p' | head -n 1)"
ITEM_ID_EXPLICIT="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^ITEM_ID=//p' | head -n 1)"
LOAD_COUNT="$(printf '%s\n' "${OUTPUT}" | grep -c '^LOAD=' || true)"
LOAD_BYTES="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^LOAD=//p' | while IFS= read -r load_path; do
  [ -f "${load_path}" ] || continue
  wc -c < "${load_path}" | tr -d ' '
done | awk '{s+=$1} END {print (s+0)}')"
ITEM_ID_WIDTH="$(execution_item_id_width "${EXECUTION_CONFIG}")"
ITEM_ID="${ITEM_ID_EXPLICIT}"
if [ -z "${ITEM_ID}" ]; then
  ITEM_ID="$(printf '%s\n' "${ITEM_NAME}" | sed -nE "s#.*(open|review|done)-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$#\\2#p" | head -n 1)"
fi

if [ -f "${EXECUTION_CONFIG}" ] && command -v run_telemetry_command >/dev/null 2>&1; then
  if [ -z "${ITEM_ID}" ]; then
    run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
      --telemetry-file "${TELEMETRY_FILE}" \
      --plan-file "${PLAN_FILE}" \
      record-task-run \
      --task "${TASK_NAME:-unknown}" \
      --context-files "${LOAD_COUNT}" \
      --context-bytes "${LOAD_BYTES}"
  else
    run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
      --telemetry-file "${TELEMETRY_FILE}" \
      --plan-file "${PLAN_FILE}" \
      record-task-run \
      --task "${TASK_NAME:-unknown}" \
      --item-id "${ITEM_ID}" \
      --context-files "${LOAD_COUNT}" \
      --context-bytes "${LOAD_BYTES}"
  fi
fi
