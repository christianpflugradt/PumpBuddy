#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/tasks.sh <task-name|alias|1-6>" >&2
  exit 2
fi

RAW_TASK="$1"
TASK="$(printf '%s' "${RAW_TASK}" | tr '[:upper:]' '[:lower:]')"

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
    *)
      printf '%s\n' "${value}"
      ;;
  esac
}

TASK="$(resolve_core_task_alias "${TASK}")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASK_SCRIPT="${SCRIPT_DIR}/task-${TASK}.sh"

if [ ! -f "${TASK_SCRIPT}" ]; then
  echo "Unknown task: ${TASK}" >&2
  exit 3
fi

STATE_VALIDATOR="${SCRIPT_DIR}/validate-execution-state.sh"
if [ -f "${STATE_VALIDATOR}" ]; then
  "${STATE_VALIDATOR}"
fi

ITEM_LINTER="${SCRIPT_DIR}/validate-item-content.sh"
if [ -f "${ITEM_LINTER}" ]; then
  "${ITEM_LINTER}"
fi

OUTPUT="$("${TASK_SCRIPT}")"
printf '%s\n' "${OUTPUT}"

TASK_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^TASK=//p' | head -n 1)"
ITEM_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^ITEM=//p' | head -n 1)"
LOAD_COUNT="$(printf '%s\n' "${OUTPUT}" | grep -c '^LOAD=' || true)"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
METRICS_DIR="agent/tmp"
METRICS_FILE="${METRICS_DIR}/task-metrics.log"

mkdir -p "${METRICS_DIR}"
printf '%s task=%s item=%s loads=%s\n' "${TIMESTAMP}" "${TASK_NAME:-unknown}" "${ITEM_NAME:-none}" "${LOAD_COUNT}" >> "${METRICS_FILE}"
