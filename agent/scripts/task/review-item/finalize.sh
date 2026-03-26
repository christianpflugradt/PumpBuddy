#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: agent/scripts/task/review-item/finalize.sh <review-item-path|item-id> <accept|return>" >&2
  exit 2
fi

ITEM_INPUT="$1"
OUTCOME="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
ITEMS_DIR="agent/execution/items"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
QUALITY_GATE_SCRIPT="agent/scripts/check/run-quality-gate.sh"
WORKFLOW_STATE_FILE="agent/execution/workflow-state.yaml"

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

if [ ! -x "${QUALITY_GATE_SCRIPT}" ]; then
  echo "Missing quality gate script: ${QUALITY_GATE_SCRIPT}" >&2
  exit 27
fi

if [ ! -f "${WORKFLOW_STATE_FILE}" ]; then
  echo "Missing workflow state file: ${WORKFLOW_STATE_FILE}" >&2
  exit 28
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

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    ITEM_ID_WIDTH="$(execution_item_id_width "${EXECUTION_CONFIG}")"
    case "${BASE}" in
      open-item-*.yaml|review-item-*.yaml|done-item-*.yaml)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -nE "s/^[a-z]*-item-([0-9]{${ITEM_ID_WIDTH}})\\.yaml$/\\1/p")"
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

ITEM_ID_WIDTH="${ITEM_ID_WIDTH:-$(execution_item_id_width "${EXECUTION_CONFIG}")}"
if ! printf '%s\n' "${ITEM_ID}" | grep -Eq "^[0-9]{${ITEM_ID_WIDTH}}$"; then
  echo "Item id must use exactly ${ITEM_ID_WIDTH} digits, got: ${ITEM_ID}" >&2
  exit 4
fi

OPEN_ITEM="${ITEMS_DIR}/open-item-${ITEM_ID}.yaml"
REVIEW_ITEM="${ITEMS_DIR}/review-item-${ITEM_ID}.yaml"
DONE_ITEM="${ITEMS_DIR}/done-item-${ITEM_ID}.yaml"
ALREADY_TRANSITIONED="false"

REVIEW_SOURCE_ITEM="${REVIEW_ITEM}"
if [ ! -f "${REVIEW_SOURCE_ITEM}" ]; then
  if [ "${OUTCOME}" = "accept" ] && [ -f "${DONE_ITEM}" ]; then
    REVIEW_SOURCE_ITEM="${DONE_ITEM}"
  elif [ "${OUTCOME}" = "return" ] && [ -f "${OPEN_ITEM}" ]; then
    REVIEW_SOURCE_ITEM="${OPEN_ITEM}"
  fi
fi

if [ ! -f "${REVIEW_SOURCE_ITEM}" ]; then
  echo "Review source item file not found for id ${ITEM_ID}: expected ${REVIEW_ITEM} or transitioned target file" >&2
  exit 5
fi

FINDINGS_COUNT="$(python3 - "${REVIEW_SOURCE_ITEM}" "${OUTCOME}" <<'PY'
import sys
from pathlib import Path

import yaml

item_path = Path(sys.argv[1])
expected_outcome = sys.argv[2]
data = yaml.safe_load(item_path.read_text(encoding="utf-8")) or {}
review_result = data.get("review_result")
if not isinstance(review_result, dict):
    raise SystemExit(f"Missing review_result in {item_path}")

actual_outcome = review_result.get("outcome")
if actual_outcome != expected_outcome:
    raise SystemExit(
        f"review_result.outcome mismatch in {item_path}: expected '{expected_outcome}', got '{actual_outcome}'"
    )

if expected_outcome == "accept":
    acceptance = review_result.get("acceptance")
    if not isinstance(acceptance, dict):
        raise SystemExit(f"review_result.acceptance must be an object in {item_path}")
    required = ["criteria_met", "evidence", "runtime_build_check", "residual_risk"]
    for key in required:
        value = acceptance.get(key)
        if not isinstance(value, str) or not value.strip():
            raise SystemExit(f"review_result.acceptance.{key} must be a non-empty string in {item_path}")
    print("0")
else:
    findings = review_result.get("findings")
    if not isinstance(findings, list) or len(findings) < 1:
        raise SystemExit(f"review_result.findings must be a non-empty list in {item_path}")
    for idx, finding in enumerate(findings, start=1):
        if not isinstance(finding, dict):
            raise SystemExit(f"review_result.findings[{idx}] must be an object in {item_path}")
        for key in ("criterion", "evidence", "risk"):
            value = finding.get(key)
            if not isinstance(value, str) or not value.strip():
                raise SystemExit(f"review_result.findings[{idx}].{key} must be a non-empty string in {item_path}")
    print(str(len(findings)))
PY
)"

RETURN_BLOCKED_DUE_INFRA="false"
if [ "${OUTCOME}" = "return" ]; then
  RETURN_BLOCKED_DUE_INFRA="$(python3 - "${REVIEW_SOURCE_ITEM}" <<'PY'
import re
import sys
from pathlib import Path

import yaml

item_path = Path(sys.argv[1])
data = yaml.safe_load(item_path.read_text(encoding="utf-8")) or {}
review_result = data.get("review_result") or {}
findings = review_result.get("findings") or []

patterns = [
    r"cannot connect to the docker daemon",
    r"docker daemon.*not running",
    r"permission denied.*docker.*socket",
    r"is the docker daemon running",
    r"docker unavailable",
    r"blocked by docker",
]

combined = []
for finding in findings:
    if isinstance(finding, dict):
        for key in ("criterion", "evidence", "risk"):
            value = finding.get(key)
            if isinstance(value, str):
                combined.append(value.lower())

text = "\n".join(combined)
blocked = any(re.search(p, text) for p in patterns)
print("true" if blocked else "false")
PY
)"
fi

load_execution_git_settings "${EXECUTION_CONFIG}"
validate_execution_git_settings

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  if [ "${OUTCOME}" = "accept" ]; then
    echo "DRY_RUN=would_run_quality_gate ${QUALITY_GATE_SCRIPT} ${REVIEW_SOURCE_ITEM}"
    echo "DRY_RUN=would_move ${REVIEW_ITEM} -> ${DONE_ITEM}"
    echo "DRY_RUN=would_update_status_hint done in ${DONE_ITEM}"
    echo "DRY_RUN=would_set_workflow_state phase=execute_items"
  else
    echo "DRY_RUN=would_move ${REVIEW_ITEM} -> ${OPEN_ITEM}"
    echo "DRY_RUN=would_update_status_hint open in ${OPEN_ITEM}"
    echo "DRY_RUN=would_set_workflow_state phase=execute_items"
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

if [ "${OUTCOME}" = "return" ] && [ "${RETURN_BLOCKED_DUE_INFRA}" = "true" ]; then
  echo "Review item return blocked: docker execution failure is an environment blocker, not an implementation finding." >&2
  echo "Keep item in review state and resolve docker availability/permissions first." >&2
  exit 41
fi

if [ "${OUTCOME}" = "accept" ]; then
  if "${QUALITY_GATE_SCRIPT}" "${REVIEW_SOURCE_ITEM}"; then
    :
  else
    status=$?
    if [ "${status}" -eq 86 ]; then
      echo "Review item finalize blocked: quality gate could not run because docker is unavailable or not permitted." >&2
      echo "Keep item in review state and fix docker access before retrying accept." >&2
    fi
    exit "${status}"
  fi
fi

if [ -f "${REVIEW_ITEM}" ]; then
  if [ "${OUTCOME}" = "accept" ]; then
    TARGET_ITEM="${DONE_ITEM}"
    mv "${REVIEW_ITEM}" "${TARGET_ITEM}"
    TARGET_STATUS="done"
  else
    TARGET_ITEM="${OPEN_ITEM}"
    mv "${REVIEW_ITEM}" "${TARGET_ITEM}"
    TARGET_STATUS="open"
  fi
else
  if [ "${OUTCOME}" = "accept" ] && [ -f "${DONE_ITEM}" ]; then
    TARGET_ITEM="${DONE_ITEM}"
    TARGET_STATUS="done"
    ALREADY_TRANSITIONED="true"
  elif [ "${OUTCOME}" = "return" ] && [ -f "${OPEN_ITEM}" ]; then
    TARGET_ITEM="${OPEN_ITEM}"
    TARGET_STATUS="open"
    ALREADY_TRANSITIONED="true"
  else
    echo "Review item file not found for id ${ITEM_ID}: ${REVIEW_ITEM}" >&2
    exit 3
  fi
fi

if [ "${ALREADY_TRANSITIONED}" != "true" ]; then
  python3 - "${TARGET_ITEM}" "${TARGET_STATUS}" "${OUTCOME}" <<'PY'
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

path = Path(sys.argv[1])
status = sys.argv[2]
outcome = sys.argv[3]
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
item = data.get("item")
if isinstance(item, dict):
    item["status_hint"] = status

if outcome == "return":
    review_result = data.get("review_result") or {}
    findings = review_result.get("findings") or []
    notes = yaml.safe_dump({"findings": findings}, sort_keys=False)
    feedback = data.get("review_feedback")
    if not isinstance(feedback, list):
        feedback = []
    feedback.append(
        {
            "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "review_result",
            "notes": notes,
        }
    )
    data["review_feedback"] = feedback

path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
fi

${ITEM_CHECK_SCRIPT}
PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"
if ! printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
  echo "Plan id in ${PLAN_FILE} must match pb-<digits>, got: ${PLAN_ID}" >&2
  exit 29
fi
if [ "${OUTCOME}" = "accept" ]; then
  reconcile_workflow_state_from_items "${WORKFLOW_STATE_FILE}" "${ITEMS_DIR}" "execute_items" "${PLAN_ID}" "item_review_accepted" "agent/execution/plan.yaml"
else
  reconcile_workflow_state_from_items "${WORKFLOW_STATE_FILE}" "${ITEMS_DIR}" "execute_items" "${PLAN_ID}" "item_review_returned" "agent/execution/plan.yaml"
fi

if [ "${ALREADY_TRANSITIONED}" != "true" ]; then
  run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
    --telemetry-file "${TELEMETRY_FILE}" \
    --plan-file "${PLAN_FILE}" \
    record-event \
    --task "review-item" \
    --event-type "review_outcome" \
    --item-id "${ITEM_ID}" \
    --outcome "${OUTCOME}" \
    --findings-count "${FINDINGS_COUNT}"
fi

record_task_run_finished "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" "${TELEMETRY_FILE}" "${PLAN_FILE}" "review-item" "${ITEM_ID}"

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

run_push_if_enabled "${EXECUTION_CONFIG}"

echo "ITEM_MOVED=${TARGET_ITEM}"
