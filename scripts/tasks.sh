#!/usr/bin/env bash
set -euo pipefail

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

exec "${TASK_SCRIPT}"
