#!/usr/bin/env sh
set -eu

if [ "$#" -ne 0 ]; then
  echo "Usage: agent/scripts/task/refine-plan/finalize.sh" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONTEXT_CONFIG="agent/execution/task-context/refine-plan.yaml"
CONTEXT_LOADER="${SCRIPT_DIR}/lib/context_loader.py"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"

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

if [ ! -f "${EXECUTION_CONFIG}" ]; then
  echo "Missing execution config: ${EXECUTION_CONFIG}" >&2
  exit 23
fi

if [ ! -x "${ITEM_CHECK_SCRIPT}" ]; then
  echo "Missing execution item check script: ${ITEM_CHECK_SCRIPT}" >&2
  exit 25
fi

${ITEM_CHECK_SCRIPT}

if [ -z "$(git status --porcelain -- agent/execution | grep 'item-' || true)" ]; then
  echo "No execution item changes detected under agent/execution." >&2
  exit 3
fi

COMMIT_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.commit_enabled" "true")"
PUSH_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.push_enabled" "true")"
PULL_REBASE_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.pull_rebase_before_push" "true")"
DRY_RUN_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "runtime.dry_run" "false")"

if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
  echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
  exit 24
fi

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  echo "DRY_RUN=would_stage_paths agent/execution"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    echo "DRY_RUN=would_git_commit docs: refine plan into execution items"
  else
    echo "DRY_RUN=commit_disabled_by_config"
  fi
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      echo "DRY_RUN=would_git_pull_rebase"
    fi
    echo "DRY_RUN=would_git_push"
  fi
  echo "REFINE_PLAN_FINALIZED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "REFINE_PLAN_FINALIZED=SKIPPED_BY_CONFIG"
  exit 0
fi

git add agent/execution

if git diff --cached --quiet; then
  echo "No staged execution item changes after git add." >&2
  exit 5
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: refine plan into execution items" git commit -m "docs: refine plan into execution items"

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

echo "REFINE_PLAN_FINALIZED=1"
