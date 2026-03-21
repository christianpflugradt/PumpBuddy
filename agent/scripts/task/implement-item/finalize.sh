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
MSG_FILE="agent/tmp/implement-item-commit-message.txt"
EXEC_DIR="agent/execution"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
COMMIT_MSG_CHECK_SCRIPT="agent/scripts/check/check-commit-message.sh"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

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

${ITEM_CHECK_SCRIPT}

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    case "${BASE}" in
      open-item-*.yaml|review-item-*.yaml)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^[a-z]*-item-\([0-9][0-9]\)\.yaml$/\1/p')"
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

if ! printf '%s\n' "${ITEM_ID}" | grep -Eq '^[0-9]{2}$'; then
  echo "Item id must use exactly two digits, got: ${ITEM_ID}" >&2
  exit 4
fi

OPEN_ITEM="${EXEC_DIR}/open-item-${ITEM_ID}.yaml"
REVIEW_ITEM="${EXEC_DIR}/review-item-${ITEM_ID}.yaml"

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
  if [ -f "${OPEN_ITEM}" ]; then
    echo "DRY_RUN=would_move ${OPEN_ITEM} -> ${TARGET}"
    echo "DRY_RUN=would_update_status_hint review in ${TARGET}"
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

if [ -f "${OPEN_ITEM}" ]; then
  mv "${OPEN_ITEM}" "${TARGET}"
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

${ITEM_CHECK_SCRIPT}

git add -A
if git diff --cached --quiet; then
  echo "No staged changes detected after implement finalize actions." >&2
  exit 9
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit_from_file ${MSG_FILE}" git commit -F "${MSG_FILE}"

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

echo "ITEM_MOVED=${TARGET}"
