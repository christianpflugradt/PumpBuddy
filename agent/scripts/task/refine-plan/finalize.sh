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
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
ARTIFACT_FORMATTER="agent/scripts/check/format-yaml-artifact.py"
WORKFLOW_POLICY_FILE="agent/execution/workflow-policy.yaml"
WORKFLOW_STATE_FILE="agent/execution/workflow-state.yaml"
ITEMS_DIR="agent/execution/items"

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

if [ ! -f "${ARTIFACT_FORMATTER}" ]; then
  echo "Missing YAML artifact formatter: ${ARTIFACT_FORMATTER}" >&2
  exit 28
fi

if [ ! -f "${WORKFLOW_POLICY_FILE}" ]; then
  echo "Missing workflow policy file: ${WORKFLOW_POLICY_FILE}" >&2
  exit 26
fi

if [ ! -f "${WORKFLOW_STATE_FILE}" ]; then
  echo "Missing workflow state file: ${WORKFLOW_STATE_FILE}" >&2
  exit 27
fi

git status --porcelain -- "${ITEMS_DIR}" | while IFS= read -r status_line; do
  item_path="$(printf '%s\n' "${status_line}" | sed 's/^...//')"
  case "${item_path}" in
    "${ITEMS_DIR}"/*item-*.yaml)
      if [ -f "${item_path}" ]; then
        python3 "${ARTIFACT_FORMATTER}" backlog-item "${item_path}"
      fi
      ;;
  esac
done

${ITEM_CHECK_SCRIPT}
validate_workflow_transition_gate_from_items "${WORKFLOW_POLICY_FILE}" "refine_plan" "execute_items" "${ITEMS_DIR}"

if [ -z "$(git status --porcelain -- agent/execution | grep 'item-' || true)" ]; then
  echo "No execution item changes detected under agent/execution." >&2
  exit 3
fi

load_execution_git_settings "${EXECUTION_CONFIG}"
validate_execution_git_settings

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  echo "DRY_RUN=would_stage_paths agent/execution"
  echo "DRY_RUN=would_set_workflow_state phase=execute_items"
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

record_task_run_finished "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" "${TELEMETRY_FILE}" "${PLAN_FILE}" "refine-plan"
PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"
if ! printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
  echo "Plan id in ${PLAN_FILE} must match pb-<digits>, got: ${PLAN_ID}" >&2
  exit 28
fi
reconcile_workflow_state_from_items "${WORKFLOW_STATE_FILE}" "${ITEMS_DIR}" "execute_items" "${PLAN_ID}" "plan_refined_into_execution_items" "agent/execution/plan.yaml"

git add agent/execution

if git diff --cached --quiet; then
  echo "No staged execution item changes after git add." >&2
  exit 5
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: refine plan into execution items" git commit -m "docs: refine plan into execution items"

run_push_if_enabled "${EXECUTION_CONFIG}"

echo "REFINE_PLAN_FINALIZED=1"
