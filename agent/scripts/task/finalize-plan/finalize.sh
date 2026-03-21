#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: agent/scripts/task/finalize-plan/finalize.sh <accept|return> [artifact-file]" >&2
  exit 2
fi

OUTCOME="$1"
ARTIFACT_FILE="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_TEMPLATE="agent/templates/telemetry-template.yaml"
PLAN_TEMPLATE="agent/templates/plan-template.yaml"
WORKFLOW_STATE_FILE="agent/execution/workflow-state.yaml"
EXEC_DIR="agent/execution"
PLAN_ITEMS_DIR="agent/execution/plans"
ARCHIVE_ROOT="archive"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
FINALIZE_RESUME_STATE="agent/tmp/finalize-plan-resume.env"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"

write_resume_state() {
  state_outcome="$1"
  state_plan_id="$2"
  state_next_plan_id="${3:-}"
  state_archive_dir="${4:-}"
  state_mutation_done="$5"

  mkdir -p "$(dirname "${FINALIZE_RESUME_STATE}")"
  cat > "${FINALIZE_RESUME_STATE}" <<EOF
RESUME_TOKEN=finalize_plan_v1
RESUME_OUTCOME=${state_outcome}
RESUME_PLAN_ID=${state_plan_id}
RESUME_NEXT_PLAN_ID=${state_next_plan_id}
RESUME_ARCHIVE_DIR=${state_archive_dir}
RESUME_MUTATION_DONE=${state_mutation_done}
EOF
}

clear_resume_state() {
  rm -f "${FINALIZE_RESUME_STATE}"
}

for required in "${EXECUTION_CONFIG}" "${PLAN_FILE}" "${PLAN_TEMPLATE}" "${TELEMETRY_TEMPLATE}" "${WORKFLOW_STATE_FILE}"; do
  if [ ! -f "${required}" ]; then
    echo "Required file missing: ${required}" >&2
    exit 21
  fi
done

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

RESUME_MODE="false"
RESUME_OUTCOME=""
RESUME_PLAN_ID=""
RESUME_NEXT_PLAN_ID=""
RESUME_ARCHIVE_DIR=""
RESUME_MUTATION_DONE=""
if [ -f "${FINALIZE_RESUME_STATE}" ]; then
  # shellcheck source=/dev/null
  . "${FINALIZE_RESUME_STATE}"
  if [ "${RESUME_TOKEN:-}" != "finalize_plan_v1" ]; then
    echo "Invalid finalize resume state marker: ${FINALIZE_RESUME_STATE}" >&2
    exit 36
  fi
  if [ "${RESUME_OUTCOME:-}" != "${OUTCOME}" ]; then
    echo "Finalize resume state outcome mismatch in ${FINALIZE_RESUME_STATE}." >&2
    echo "Expected outcome: ${RESUME_OUTCOME:-unknown}; got: ${OUTCOME}" >&2
    exit 36
  fi
  if [ "${RESUME_MUTATION_DONE:-}" != "true" ]; then
    echo "Finalize resume state exists but mutation is incomplete: ${FINALIZE_RESUME_STATE}" >&2
    echo "Please inspect and resolve manually before retrying finalize." >&2
    exit 36
  fi
  RESUME_MODE="true"
fi

if [ "${RESUME_MODE}" != "true" ]; then
  DONE_COUNT="$(find "${EXEC_DIR}" -maxdepth 1 -type f -name 'done-item-*.yaml' | wc -l | tr -d ' ')"
  OPEN_COUNT="$(find "${EXEC_DIR}" -maxdepth 1 -type f -name 'open-item-*.yaml' | wc -l | tr -d ' ')"
  REVIEW_COUNT="$(find "${EXEC_DIR}" -maxdepth 1 -type f -name 'review-item-*.yaml' | wc -l | tr -d ' ')"

  if [ "${DONE_COUNT}" -lt 1 ]; then
    echo "Finalize blocked: at least one done item is required." >&2
    exit 30
  fi

  if [ "${OPEN_COUNT}" -ne 0 ] || [ "${REVIEW_COUNT}" -ne 0 ]; then
    echo "Finalize blocked: open or review items still exist." >&2
    exit 31
  fi
fi

COMMIT_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.commit_enabled" "true")"
PUSH_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.push_enabled" "true")"
PULL_REBASE_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "git.pull_rebase_before_push" "true")"
DRY_RUN_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "runtime.dry_run" "false")"
RELEASE_TRIGGER_ENABLED="$(read_execution_flag "${EXECUTION_CONFIG}" "release.trigger_on_finalize_accept" "true")"

if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
  echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
  exit 24
fi

if [ "${RELEASE_TRIGGER_ENABLED}" = "true" ] && [ "${PUSH_ENABLED}" != "true" ]; then
  echo "Invalid execution config: release.trigger_on_finalize_accept=true requires git.push_enabled=true." >&2
  exit 24
fi

if [ "${OUTCOME}" = "return" ]; then
  if [ "${RESUME_MODE}" = "true" ] && [ "${RESUME_MUTATION_DONE}" = "true" ]; then
    :
  elif [ -z "${ARTIFACT_FILE}" ]; then
    echo "Return outcome requires an artifact file." >&2
    exit 5
  elif [ ! -f "${ARTIFACT_FILE}" ]; then
    echo "Findings artifact file not found: ${ARTIFACT_FILE}" >&2
    exit 5
  elif [ ! -s "${ARTIFACT_FILE}" ]; then
    echo "Findings artifact file is empty: ${ARTIFACT_FILE}" >&2
    exit 6
  fi
fi

FINALIZE_FINDINGS_COUNT=0
if [ "${OUTCOME}" = "return" ]; then
  FINALIZE_FINDINGS_COUNT="$(python3 - "${ARTIFACT_FILE}" <<'PY'
import sys
from pathlib import Path

import yaml

path = Path(sys.argv[1])
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
items = data.get("items", [])
print(len(items) if isinstance(items, list) else 0)
PY
)"
fi

PLAN_ID=""
PLAN_NAME=""
PLAN_NUM=""
PLAN_WIDTH=""
PLAN_NUM_BASE10=""
NEXT_PLAN_NUM=""
NEXT_PLAN_ID=""
PLAN_SLUG=""
ARCHIVE_DIR=""
SKIP_MUTATION="false"

if [ "${RESUME_MODE}" = "true" ]; then
  PLAN_ID="${RESUME_PLAN_ID}"
  NEXT_PLAN_ID="${RESUME_NEXT_PLAN_ID}"
  ARCHIVE_DIR="${RESUME_ARCHIVE_DIR}"
  SKIP_MUTATION="true"
  if ! printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
    echo "Invalid plan id in finalize resume state: ${PLAN_ID}" >&2
    exit 36
  fi
  if [ "${OUTCOME}" = "accept" ]; then
    if [ -z "${NEXT_PLAN_ID}" ] || [ -z "${ARCHIVE_DIR}" ]; then
      echo "Finalize resume state is missing next plan metadata for accept." >&2
      exit 36
    fi
  fi
else
  PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"
  if ! printf '%s\n' "${PLAN_ID}" | grep -Eq '^pb-[0-9]+$'; then
    echo "Plan id in ${PLAN_FILE} must match pb-<digits>, got: ${PLAN_ID}" >&2
    exit 32
  fi

  PLAN_NAME="$(python3 - "${PLAN_FILE}" <<'PY'
import sys
from pathlib import Path

import yaml

path = Path(sys.argv[1])
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
name = data.get("name", "")
print(name if isinstance(name, str) else "")
PY
)"

  if [ -z "${PLAN_NAME}" ]; then
    echo "Plan name is missing in ${PLAN_FILE}." >&2
    exit 33
  fi

  PLAN_NUM="${PLAN_ID#pb-}"
  PLAN_WIDTH="${#PLAN_NUM}"
  PLAN_NUM_BASE10="$(printf '%s' "${PLAN_NUM}" | sed 's/^0*//')"
  if [ -z "${PLAN_NUM_BASE10}" ]; then
    PLAN_NUM_BASE10=0
  fi
  NEXT_PLAN_NUM="$((PLAN_NUM_BASE10 + 1))"
  NEXT_PLAN_ID="$(printf "pb-%0${PLAN_WIDTH}d" "${NEXT_PLAN_NUM}")"

  PLAN_SLUG="$(printf '%s' "${PLAN_NAME}" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9.-')"
  if [ -z "${PLAN_SLUG}" ]; then
    echo "Plan name slug is empty after sanitization: ${PLAN_NAME}" >&2
    exit 34
  fi
  ARCHIVE_DIR="${ARCHIVE_ROOT}/${PLAN_ID}_${PLAN_SLUG}"
fi

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  if [ "${OUTCOME}" = "accept" ]; then
    echo "DRY_RUN=would_archive_plan_to ${ARCHIVE_DIR}"
    echo "DRY_RUN=would_copy_telemetry_to_archive"
    echo "DRY_RUN=would_move_done_items_to_archive"
    echo "DRY_RUN=would_copy_plan_items_to_archive_flat"
    echo "DRY_RUN=would_clear_execution_plans_directory"
    echo "DRY_RUN=would_render_next_plan_id ${NEXT_PLAN_ID}"
    echo "DRY_RUN=would_reset_telemetry_for_next_plan ${NEXT_PLAN_ID}"
    echo "DRY_RUN=would_set_workflow_state phase=discuss_plan active_plan_id=${NEXT_PLAN_ID}"
  else
    echo "DRY_RUN=would_create_open_items_from ${ARTIFACT_FILE}"
    echo "DRY_RUN=would_set_workflow_state phase=execute_items active_plan_id=${PLAN_ID}"
  fi
  echo "DRY_RUN=would_stage_paths all_changed_files"
  if [ "${COMMIT_ENABLED}" = "true" ]; then
    if [ "${OUTCOME}" = "accept" ]; then
      echo "DRY_RUN=would_git_commit docs: finalize plan ${PLAN_ID}"
    else
      echo "DRY_RUN=would_git_commit docs: return finalize plan ${PLAN_ID} with findings"
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
  if [ "${OUTCOME}" = "accept" ] && [ "${RELEASE_TRIGGER_ENABLED}" = "true" ]; then
    echo "DRY_RUN=would_trigger_release_workflow release.yaml"
  fi
  echo "PLAN_FINALIZED=DRY_RUN"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ]; then
  echo "FINALIZE_MODE=no_commit_no_push"
  echo "PLAN_FINALIZED=SKIPPED_BY_CONFIG"
  exit 0
fi

if [ "${RESUME_MODE}" != "true" ]; then
  python3 "${SCRIPT_DIR}/lib/telemetry.py" \
    --telemetry-file "${TELEMETRY_FILE}" \
    --plan-file "${PLAN_FILE}" \
    record-event \
    --task "finalize-plan" \
    --event-type "finalize_outcome" \
    --outcome "${OUTCOME}" \
    --findings-count "${FINALIZE_FINDINGS_COUNT}"

  python3 "${SCRIPT_DIR}/lib/telemetry.py" \
    --telemetry-file "${TELEMETRY_FILE}" \
    --plan-file "${PLAN_FILE}" \
    record-event \
    --task "finalize-plan" \
    --event-type "task_run_finished"
fi

if [ "${OUTCOME}" = "accept" ]; then
  if [ "${SKIP_MUTATION}" != "true" ]; then
    write_resume_state "${OUTCOME}" "${PLAN_ID}" "${NEXT_PLAN_ID}" "${ARCHIVE_DIR}" "false"
    if [ -e "${ARCHIVE_DIR}" ]; then
      echo "Archive target already exists: ${ARCHIVE_DIR}" >&2
      exit 35
    fi

    mkdir -p "${ARCHIVE_DIR}"
    if [ -f "${TELEMETRY_FILE}" ]; then
      cp "${TELEMETRY_FILE}" "${ARCHIVE_DIR}/telemetry.yaml"
    fi
    mv "${PLAN_FILE}" "${ARCHIVE_DIR}/plan.yaml"
    find "${EXEC_DIR}" -maxdepth 1 -type f -name 'done-item-*.yaml' | while IFS= read -r path; do
      mv "${path}" "${ARCHIVE_DIR}/$(basename "${path}")"
    done
    if [ -d "${PLAN_ITEMS_DIR}" ]; then
      find "${PLAN_ITEMS_DIR}" -maxdepth 1 -type f -name 'plan-item-*.yaml' | while IFS= read -r path; do
        cp "${path}" "${ARCHIVE_DIR}/$(basename "${path}")"
        rm -f "${path}"
      done
    fi

    python3 - "${PLAN_TEMPLATE}" "${PLAN_FILE}" "${NEXT_PLAN_ID}" <<'PY'
import sys
from pathlib import Path

content = Path(sys.argv[1]).read_text(encoding="utf-8")
Path(sys.argv[2]).write_text(content.replace("__PLAN_ID__", sys.argv[3]), encoding="utf-8")
PY

    python3 - "${TELEMETRY_TEMPLATE}" "${TELEMETRY_FILE}" "${NEXT_PLAN_ID}" <<'PY'
import sys
from pathlib import Path

content = Path(sys.argv[1]).read_text(encoding="utf-8")
Path(sys.argv[2]).write_text(content.replace("__PLAN_ID__", sys.argv[3]), encoding="utf-8")
PY

    python3 - "${WORKFLOW_STATE_FILE}" "${NEXT_PLAN_ID}" <<'PY'
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

path = Path(sys.argv[1])
next_plan_id = sys.argv[2]
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
current = data.setdefault("current", {})
item_counters = data.setdefault("item_counters", {})
last = data.setdefault("last_transition", {})

prev = current.get("phase")
current["phase"] = "discuss_plan"
current["active_plan_id"] = next_plan_id
current["active_plan_path"] = "agent/execution/plan.yaml"

item_counters["open"] = 0
item_counters["review"] = 0
item_counters["done"] = 0

last["at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
last["from"] = prev
last["to"] = "discuss_plan"
last["reason"] = "stakeholder_accepted_finalize"

path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
    write_resume_state "${OUTCOME}" "${PLAN_ID}" "${NEXT_PLAN_ID}" "${ARCHIVE_DIR}" "true"
  fi

  ${ITEM_CHECK_SCRIPT}
  git add -A
  if git diff --cached --quiet; then
    echo "No staged changes detected after finalize accept actions." >&2
    exit 9
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: finalize plan ${PLAN_ID}" \
    git commit -m "docs: finalize plan ${PLAN_ID}"
else
  if [ "${SKIP_MUTATION}" != "true" ]; then
    write_resume_state "${OUTCOME}" "${PLAN_ID}" "" "" "false"
    python3 - "${ARTIFACT_FILE}" "${EXEC_DIR}" "${PLAN_ID}" "${WORKFLOW_STATE_FILE}" <<'PY'
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

findings_path = Path(sys.argv[1])
exec_dir = Path(sys.argv[2])
plan_id = sys.argv[3]
state_path = Path(sys.argv[4])

raw = yaml.safe_load(findings_path.read_text(encoding="utf-8")) or {}
items = raw.get("items", [])
if not isinstance(items, list) or len(items) < 1:
    raise SystemExit(f"Findings artifact must contain non-empty items list: {findings_path}")

id_pattern = re.compile(r"^(open|review|done)-item-(\d{2})\.yaml$")
existing_ids = []
for p in exec_dir.glob("*item-*.yaml"):
    m = id_pattern.match(p.name)
    if m:
        existing_ids.append(int(m.group(2)))

next_id = (max(existing_ids) + 1) if existing_ids else 1
created = 0

for draft in items:
    if next_id > 99:
        raise SystemExit("Cannot create more execution items: next id would exceed 99.")
    if not isinstance(draft, dict):
        raise SystemExit("Each findings item must be an object.")

    title = str(draft.get("title", "")).strip()
    if not title:
        raise SystemExit("Each findings item requires title.")

    intent_outcome = str(draft.get("intent_outcome", "")).strip()
    rationale = str(draft.get("rationale", "")).strip()
    scope_in = draft.get("scope_in", []) or []
    scope_out = draft.get("scope_out", []) or []
    constraints = draft.get("constraints", []) or []
    inputs = draft.get("inputs", {}) or {}
    req_inputs = inputs.get("required", []) or []
    opt_inputs = inputs.get("optional", []) or []
    acs = draft.get("acceptance_criteria", []) or []
    risk_level = str(draft.get("risk_level", "medium"))
    boundary_impact = draft.get("boundary_impact", []) or ["execution"]
    review_focus = draft.get("review_focus", []) or ["check_blocking_finding_is_resolved"]

    if not intent_outcome or not rationale:
        raise SystemExit("Each findings item requires intent_outcome and rationale.")
    if not scope_in or not scope_out or not constraints or not req_inputs or not acs:
        raise SystemExit("Each findings item requires scope_in, scope_out, constraints, inputs.required, and acceptance_criteria.")

    item_num = f"{next_id:02d}"
    payload = {
        "version": 1,
        "kind": "backlog_item",
        "item": {
            "id": f"{plan_id}-item-{item_num}",
            "title": title,
            "status_hint": "open",
            "source": {
                "type": "finalize_return",
                "reference": str(findings_path),
            },
        },
        "intent": {
            "outcome": intent_outcome,
            "rationale": rationale,
        },
        "scope": {
            "in": scope_in,
            "out": scope_out,
        },
        "constraints": constraints,
        "inputs": {
            "required": req_inputs,
            "optional": opt_inputs,
        },
        "acceptance_criteria": acs,
        "execution": {
            "plan_item_required": True,
            "risk_level": risk_level,
            "boundary_impact": boundary_impact,
        },
        "handoff": {
            "review_focus": review_focus,
        },
    }

    target = exec_dir / f"open-item-{item_num}.yaml"
    target.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")

    next_id += 1
    created += 1

state = yaml.safe_load(state_path.read_text(encoding="utf-8")) or {}
current = state.setdefault("current", {})
item_counters = state.setdefault("item_counters", {})
last = state.setdefault("last_transition", {})

prev = current.get("phase")
current["phase"] = "execute_items"
current["active_plan_id"] = plan_id
current["active_plan_path"] = "agent/execution/plan.yaml"

item_counters["open"] = created
item_counters["review"] = 0
item_counters["done"] = len(list(exec_dir.glob("done-item-*.yaml")))

last["at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
last["from"] = prev
last["to"] = "execute_items"
last["reason"] = "stakeholder_rejected_finalize"

state_path.write_text(yaml.safe_dump(state, sort_keys=False), encoding="utf-8")
print(created)
PY
    write_resume_state "${OUTCOME}" "${PLAN_ID}" "" "" "true"
  fi

  ${ITEM_CHECK_SCRIPT}
  git add -A
  if git diff --cached --quiet; then
    echo "No staged changes detected after finalize return actions." >&2
    exit 9
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: return finalize plan ${PLAN_ID} with findings" \
    git commit -m "docs: return finalize plan ${PLAN_ID} with findings"
fi

if [ "${PUSH_ENABLED}" = "true" ]; then
  if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
    run_write_command "${EXECUTION_CONFIG}" "would_git_pull_rebase" git pull -r
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_git_push" git push
fi

if [ "${OUTCOME}" = "accept" ] && [ "${RELEASE_TRIGGER_ENABLED}" = "true" ]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "Release trigger failed: gh CLI is not installed." >&2
    exit 37
  fi
  run_write_command "${EXECUTION_CONFIG}" "would_trigger_release_workflow release.yaml" \
    gh workflow run release.yaml --ref main
fi

clear_resume_state
echo "PLAN_FINALIZED=${OUTCOME}"
