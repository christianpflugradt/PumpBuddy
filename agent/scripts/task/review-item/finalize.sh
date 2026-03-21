#!/usr/bin/env sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: agent/scripts/task/review-item/finalize.sh <review-item-path|item-id> <accept|return> <artifact-file>" >&2
  exit 2
fi

ITEM_INPUT="$1"
OUTCOME="$2"
ARTIFACT_FILE="$3"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
EXEC_DIR="agent/execution"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"

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

${ITEM_CHECK_SCRIPT}

case "${OUTCOME}" in
  accept|return)
    ;;
  *)
    echo "Outcome must be one of: accept | return. Got: ${OUTCOME}" >&2
    exit 4
    ;;
esac

if [ ! -f "${ARTIFACT_FILE}" ]; then
  echo "Artifact file not found: ${ARTIFACT_FILE}" >&2
  exit 5
fi

if [ ! -s "${ARTIFACT_FILE}" ]; then
  echo "Artifact file is empty: ${ARTIFACT_FILE}" >&2
  exit 6
fi

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    case "${BASE}" in
      open-item-*.yaml|review-item-*.yaml|done-item-*.yaml)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^[a-z]*-item-\([0-9][0-9]\)\.yaml$/\1/p')"
        ;;
      *)
        echo "Expected an open/review/done item file or numeric item id, got: ${ITEM_INPUT}" >&2
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
DONE_ITEM="${EXEC_DIR}/done-item-${ITEM_ID}.yaml"

if [ "${OUTCOME}" = "accept" ]; then
  for required in "- Criteria Met:" "- Evidence:" "- Runtime/Build Check:" "- Residual Risk:"; do
    if ! grep -q -- "${required}" "${ARTIFACT_FILE}"; then
      echo "Acceptance artifact missing required marker '${required}': ${ARTIFACT_FILE}" >&2
      exit 7
    fi
  done
else
  for required in "### Criterion" "- Status:" "- Evidence:" "- Risk:"; do
    if ! grep -q -- "${required}" "${ARTIFACT_FILE}"; then
      echo "Findings artifact missing required marker '${required}': ${ARTIFACT_FILE}" >&2
      exit 7
    fi
  done
fi

FINDINGS_COUNT=0
if [ "${OUTCOME}" = "return" ]; then
  FINDINGS_COUNT="$(grep -c '^### Criterion' "${ARTIFACT_FILE}" || true)"
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
  if [ "${OUTCOME}" = "accept" ]; then
    echo "DRY_RUN=would_move ${REVIEW_ITEM} -> ${DONE_ITEM}"
    echo "DRY_RUN=would_update_status_hint done in ${DONE_ITEM}"
  else
    echo "DRY_RUN=would_move ${REVIEW_ITEM} -> ${OPEN_ITEM}"
    echo "DRY_RUN=would_update_status_hint open in ${OPEN_ITEM}"
  fi
  echo "DRY_RUN=would_stage_paths all_changed_files"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    if [ "${OUTCOME}" = "accept" ]; then
      echo "DRY_RUN=would_git_commit docs: accept review item ${ITEM_ID}"
    else
      echo "DRY_RUN=would_git_commit docs: return review item ${ITEM_ID} with findings"
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
  echo "ITEM_MOVED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "ITEM_MOVED=SKIPPED_BY_CONFIG"
  exit 0
fi

if [ ! -f "${REVIEW_ITEM}" ]; then
  echo "Review item file not found for id ${ITEM_ID}: ${REVIEW_ITEM}" >&2
  exit 3
fi

if [ "${OUTCOME}" = "accept" ]; then
  TARGET_ITEM="${DONE_ITEM}"
  mv "${REVIEW_ITEM}" "${TARGET_ITEM}"
  TARGET_STATUS="done"
else
  TARGET_ITEM="${OPEN_ITEM}"
  mv "${REVIEW_ITEM}" "${TARGET_ITEM}"
  TARGET_STATUS="open"
fi

python3 - "${TARGET_ITEM}" "${TARGET_STATUS}" "${OUTCOME}" "${ARTIFACT_FILE}" <<'PY'
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

path = Path(sys.argv[1])
status = sys.argv[2]
outcome = sys.argv[3]
artifact_file = Path(sys.argv[4])
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
item = data.get("item")
if isinstance(item, dict):
    item["status_hint"] = status

if outcome == "return":
    notes = artifact_file.read_text(encoding="utf-8")
    feedback = data.get("review_feedback")
    if not isinstance(feedback, list):
        feedback = []
    feedback.append(
        {
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": artifact_file.as_posix(),
            "notes": notes,
        }
    )
    data["review_feedback"] = feedback

path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY

${ITEM_CHECK_SCRIPT}

git add -A
if git diff --cached --quiet; then
  echo "No staged changes detected after review finalize actions." >&2
  exit 9
fi

if [ "${OUTCOME}" = "accept" ]; then
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: accept review item ${ITEM_ID}" \
    git commit -m "docs: accept review item ${ITEM_ID}"
else
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: return review item ${ITEM_ID} with findings" \
    git commit -m "docs: return review item ${ITEM_ID} with findings"
fi

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
  --telemetry-file "${TELEMETRY_FILE}" \
  --plan-file "${PLAN_FILE}" \
  record-event \
  --task "review-item" \
  --event-type "review_outcome" \
  --item-id "${ITEM_ID}" \
  --outcome "${OUTCOME}" \
  --findings-count "${FINDINGS_COUNT}"

echo "ITEM_MOVED=${TARGET_ITEM}"
