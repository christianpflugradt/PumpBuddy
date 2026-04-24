#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${ROOT_DIR}"

try_delegate() {
  task_name="$1"
  task_script="${SCRIPT_DIR}/task/${task_name}/run.sh"
  output_file=""

  if [ ! -x "${task_script}" ]; then
    echo "Missing delegated task script: ${task_script}" >&2
    exit 21
  fi

  output_file="$(mktemp)"
  if "${task_script}" >"${output_file}"; then
    cat "${output_file}"
    rm -f "${output_file}"
    exit 0
  else
    status="$?"
  fi

  rm -f "${output_file}"
  case "${task_name}:${status}" in
    review-item:10)
      return 0
      ;;
    plan-item:10|plan-item:13)
      return 0
      ;;
    implement-item:10|implement-item:12)
      ;;
    *)
      echo "Delegated task failed: ${task_name} (exit ${status})" >&2
      exit "${status}"
      ;;
  esac

  if [ "${task_name}" = "plan-item" ]; then
    echo "No next item available (priority order: review-item -> implement-item -> plan-item)." >&2
    exit 10
  fi

  return 0
}

try_delegate "review-item"
try_delegate "implement-item"
try_delegate "plan-item"
