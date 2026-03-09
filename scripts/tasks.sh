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

exec "${TASK_SCRIPT}"
