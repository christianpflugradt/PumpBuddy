#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${ROOT_DIR}"

try_delegate() {
  task_name="$1"
  task_script="${SCRIPT_DIR}/task/${task_name}/run.sh"

  if [ ! -x "${task_script}" ]; then
    echo "Missing delegated task script: ${task_script}" >&2
    exit 21
  fi

  if output="$(${task_script})"; then
    printf %sn "${output}"
    exit 0
  fi

  status="$?"
  case "${task_name}:${status}" in
    review-item:10)
      return 0
      ;;
    plan-item:10|plan-item:13)
      return 0
      ;;
    implement-item:10)
      ;;
    *)
      echo "Delegated task failed: ${task_name} (exit ${status})" >&2
      exit "${status}"
      ;;
  esac

  if [ "${task_name}" = "implement-item" ]; then
    echo "No next item available (priority order: review-item -> plan-item -> implement-item)." >&2
    exit 10
  fi

  return 0
}

try_delegate "review-item"
try_delegate "plan-item"
try_delegate "implement-item"
