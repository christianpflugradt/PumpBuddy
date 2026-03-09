#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/tasks.sh <task-name>" >&2
  exit 2
fi

TASK="$1"
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
