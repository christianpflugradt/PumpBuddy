#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/task/implement-item/finalize.sh <open-item-path|item-id>" >&2
  exit 2
fi

ITEM_INPUT="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
MSG_FILE="agent/tmp/implement-item-commit-message.txt"
ITEMS_DIR="agent/execution/items"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
COMMIT_MSG_CHECK_SCRIPT="agent/scripts/check/check-commit-message.sh"
WORKFLOW_STATE_FILE="agent/execution/workflow-state.yaml"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

sync_plan_item_path() {
  plan_path="$1"
  item_path="$2"

  [ -f "${plan_path}" ] || return 0

  python3 - "${plan_path}" "${item_path}" <<'PY'
import sys
from pathlib import Path

import yaml

plan_path = Path(sys.argv[1])
item_path = sys.argv[2]
data = yaml.safe_load(plan_path.read_text(encoding="utf-8")) or {}
if not isinstance(data, dict):
    raise SystemExit(0)
plan = data.get("plan")
if not isinstance(plan, dict):
    raise SystemExit(0)
if plan.get("item_path") == item_path:
    raise SystemExit(0)
plan["item_path"] = item_path
plan_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
}

if [ ! -f "${EXECUTION_CONFIG}" ]; then
  echo "Missing execution config: ${EXECUTION_CONFIG}" >&2
  exit 23
fi

if [ ! -x "${ITEM_CHECK_SCRIPT}" ]; then
  echo "Missing execution item check script: ${ITEM_CHECK_SCRIPT}" >&2
  exit 25
fi

if [ ! -x "${COMMIT_MSG_CHECK_SCRIPT}" ]; then
  echo "Missing commit message check script: ${COMMIT_MSG_CHECK_SCRIPT}" >&2
  exit 26
fi

if [ ! -f "${WORKFLOW_STATE_FILE}" ]; then
  echo "Missing workflow state file: ${WORKFLOW_STATE_FILE}" >&2
  exit 27
fi

${ITEM_CHECK_SCRIPT}

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    ITEM_ID_WIDTH="$(execution_item_id_width "${EXECUTION_CONFIG}")"
    case "${BASE}" in
      open-item-*.yaml|review-item-*.yaml)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -nE "s/^[a-z]*-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
        ;;
      *)
        echo "Expected an open/review item file or numeric item id, got: ${ITEM_INPUT}" >&2
        exit 4
        ;;
    esac
    ;;
  *)
    ITEM_ID="${ITEM_INPUT}"
    ;;
esac

if [ -z "${ITEM_ID}" ]; then
  echo "Could not determine item id from input: ${ITEM_INPUT}" >&2
  exit 4
fi

ITEM_ID_WIDTH="${ITEM_ID_WIDTH:-$(execution_item_id_width "${EXECUTION_CONFIG}")}"
if ! printf '%s\n' "${ITEM_ID}" | grep -Eq "^[0-9]{${ITEM_ID_WIDTH}}$"; then
  echo "Item id must use exactly ${ITEM_ID_WIDTH} digits, got: ${ITEM_ID}" >&2
  exit 4
fi

OPEN_ITEM="${ITEMS_DIR}/open-item-${ITEM_ID}.yaml"
REVIEW_ITEM="${ITEMS_DIR}/review-item-${ITEM_ID}.yaml"
PLAN_ITEM="${ROOT_DIR}/agent/execution/plans/plan-item-${ITEM_ID}.yaml"

if [ -f "${OPEN_ITEM}" ] && [ -f "${REVIEW_ITEM}" ]; then
  echo "Conflicting item states found for id ${ITEM_ID}: ${OPEN_ITEM} and ${REVIEW_ITEM}" >&2
  exit 7
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

TARGET="${REVIEW_ITEM}"
if [ ! -f "${OPEN_ITEM}" ] && [ ! -f "${TARGET}" ]; then
  echo "Item file not found for id ${ITEM_ID}: expected ${OPEN_ITEM} or ${TARGET}" >&2
  exit 3
fi

load_execution_git_settings "${EXECUTION_CONFIG}"
validate_execution_git_settings

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  if [ -f "${OPEN_ITEM}" ]; then
    echo "DRY_RUN=would_move ${OPEN_ITEM} -> ${TARGET}"
    echo "DRY_RUN=would_update_status_hint review in ${TARGET}"
    echo "DRY_RUN=would_set_workflow_state phase=execute_items"
  fi
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
  echo "ITEM_MOVED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "ITEM_MOVED=SKIPPED_BY_CONFIG"
  exit 0
fi

MOVED_FROM_OPEN="false"
if [ -f "${OPEN_ITEM}" ]; then
  mv "${OPEN_ITEM}" "${TARGET}"
  MOVED_FROM_OPEN="true"
  python3 - "${TARGET}" <<'PY'
import sys
from pathlib import Path

import yaml

path = Path(sys.argv[1])
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
item = data.get("item")
if isinstance(item, dict):
    item["status_hint"] = "review"
path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
fi

sync_plan_item_path "${PLAN_ITEM}" "${TARGET}"

${ITEM_CHECK_SCRIPT}

PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"
if ! printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
  echo "Plan id in ${PLAN_FILE} must match pb-<digits>, got: ${PLAN_ID}" >&2
  exit 28
fi
reconcile_workflow_state_from_items "${WORKFLOW_STATE_FILE}" "${ITEMS_DIR}" "execute_items" "${PLAN_ID}" "item_moved_open_to_review" "agent/execution/plan.yaml"

if [ "${MOVED_FROM_OPEN}" = "true" ]; then
  run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
    --telemetry-file "${TELEMETRY_FILE}" \
    --plan-file "${PLAN_FILE}" \
    record-event \
    --task "implement-item" \
    --event-type "implement_transition" \
    --item-id "${ITEM_ID}" \
    --from-status "open" \
    --to-status "review"
fi

record_task_run_finished "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" "${TELEMETRY_FILE}" "${PLAN_FILE}" "implement-item" "${ITEM_ID}"

git add -A
if git diff --cached --quiet; then
  echo "No staged changes detected after implement finalize actions." >&2
  exit 9
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit_from_file ${MSG_FILE}" git commit -F "${MSG_FILE}"

run_push_if_enabled "${EXECUTION_CONFIG}"

echo "ITEM_MOVED=${TARGET}"
