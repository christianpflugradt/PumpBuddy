#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/task/plan-item/finalize.sh <plan-item-path>" >&2
  exit 2
fi

PLAN_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

if [ ! -f "${PLAN_PATH}" ]; then
  echo "Plan item file not found: ${PLAN_PATH}" >&2
  exit 3
fi

if [ ! -f "${EXECUTION_CONFIG}" ]; then
  echo "Missing execution config: ${EXECUTION_CONFIG}" >&2
  exit 23
fi

if [ -z "$(git status --porcelain -- "${PLAN_PATH}")" ]; then
  echo "No changes detected for plan item: ${PLAN_PATH}" >&2
  exit 4
fi

COMMIT_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.commit_enabled" "true")"
PUSH_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.push_enabled" "true")"
PULL_REBASE_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.pull_rebase_before_push" "true")"
DRY_RUN_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "runtime.dry_run" "false")"

if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
  echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
  exit 24
fi

PLAN_BASE="$(basename "${PLAN_PATH}")"
ITEM_ID="$(printf '%s' "${PLAN_BASE}" | sed -n 's/^plan-item-\([0-9][0-9]\)\.yaml$/\1/p')"

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  echo "DRY_RUN=would_stage_paths ${PLAN_PATH}"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    if [ -n "${ITEM_ID}" ]; then
      echo "DRY_RUN=would_git_commit docs: update item plan ${ITEM_ID}"
    else
      echo "DRY_RUN=would_git_commit docs: update item plan"
    fi
  else
    echo "DRY_RUN=commit_disabled_by_config"
  fi
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      echo "DRY_RUN=would_git_pull_rebase"
    fi
    echo "DRY_RUN=would_git_push"
  fi
  echo "PLAN_ITEM_FINALIZED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "PLAN_ITEM_FINALIZED=SKIPPED_BY_CONFIG"
  exit 0
fi

git add "${PLAN_PATH}"
if git diff --cached --quiet; then
  echo "No staged plan item changes after git add." >&2
  exit 5
fi

if [ -n "${ITEM_ID}" ]; then
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: update item plan ${ITEM_ID}" git commit -m "docs: update item plan ${ITEM_ID}"
else
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: update item plan" git commit -m "docs: update item plan"
fi

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

echo "PLAN_ITEM_FINALIZED=${PLAN_PATH}"
