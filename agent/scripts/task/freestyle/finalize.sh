#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: agent/scripts/task/freestyle/finalize.sh <approve> [commit-message-file]" >&2
  exit 2
fi

APPROVAL_TOKEN="$1"
MSG_FILE="${2:-agent/tmp/freestyle-commit-message.txt}"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
COMMIT_MSG_CHECK_SCRIPT="agent/scripts/check/check-commit-message.sh"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

if [ "${APPROVAL_TOKEN}" != "approve" ]; then
  echo "Refusing to commit without explicit approval token." >&2
  echo "Run: agent/scripts/task/freestyle/finalize.sh approve [commit-message-file]" >&2
  exit 4
fi

if [ ! -f "${EXECUTION_CONFIG}" ]; then
  echo "Missing execution config: ${EXECUTION_CONFIG}" >&2
  exit 23
fi

if [ ! -x "${COMMIT_MSG_CHECK_SCRIPT}" ]; then
  echo "Missing commit message check script: ${COMMIT_MSG_CHECK_SCRIPT}" >&2
  exit 26
fi

if [ ! -f "${MSG_FILE}" ]; then
  echo "Commit message file not found: ${MSG_FILE}" >&2
  exit 5
fi

if [ ! -s "${MSG_FILE}" ]; then
  echo "Commit message file is empty: ${MSG_FILE}" >&2
  exit 6
fi

FIRST_LINE="$(sed -n '1p' "${MSG_FILE}" || true)"
if printf '%s' "${FIRST_LINE}" | grep -qE '^Status:[[:space:]]+'; then
  echo "Refusing to commit: ${MSG_FILE} appears to contain task output (starts with 'Status:')." >&2
  echo "Please write a Conventional Commit-style message to ${MSG_FILE} before running this script." >&2
  exit 8
fi

"${COMMIT_MSG_CHECK_SCRIPT}" "${MSG_FILE}"

load_execution_git_settings "${EXECUTION_CONFIG}"
validate_execution_git_settings

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  echo "DRY_RUN=would_stage_paths all_changed_files"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    echo "DRY_RUN=would_git_commit_from_file ${MSG_FILE}"
  else
    echo "DRY_RUN=commit_disabled_by_config"
  fi
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      echo "DRY_RUN=would_git_pull_rebase"
    fi
    echo "DRY_RUN=would_git_push"
  fi
  echo "FREESTYLE_COMMITTED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "FREESTYLE_COMMITTED=SKIPPED_BY_CONFIG"
  exit 0
fi

record_task_run_finished "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" "${TELEMETRY_FILE}" "${PLAN_FILE}" "freestyle"

git add -A
if git diff --cached --quiet; then
  echo "No staged changes detected after freestyle finalize actions." >&2
  exit 9
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit_from_file ${MSG_FILE}" git commit -F "${MSG_FILE}"

run_push_if_enabled "${EXECUTION_CONFIG}"

echo "FREESTYLE_COMMITTED=1"
