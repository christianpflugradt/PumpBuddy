#!/usr/bin/env sh
set -eu

if [ "$#" -ne 3 ]; then
  echo "Usage: agent/scripts/task/extended-review/finalize.sh <review-task> <findings-file> <selection>" >&2
  echo "Selections: none, all, only F02 F03, all but F01 F03, or legacy only-p0..only-p3/through-p0..through-p3" >&2
  exit 2
fi

REVIEW_TASK="$1"
FINDINGS_FILE="$2"
SELECTION_RAW="$3"
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EXECUTION_CONFIG="agent/execution/execution-config.yaml"
PLAN_FILE_FOR_TELEMETRY="agent/execution/plan.yaml"
TELEMETRY_FILE="agent/execution/telemetry.yaml"
TELEMETRY_SCRIPT="${SCRIPT_DIR}/lib/telemetry.py"
PLAN_FILE="agent/execution/plan.yaml"
WORKFLOW_STATE_FILE="agent/execution/workflow-state.yaml"
WORKFLOW_POLICY_FILE="agent/execution/workflow-policy.yaml"
EXEC_DIR="agent/execution/items"
ITEM_CHECK_SCRIPT="agent/scripts/check/check-execution-items.sh"
ARTIFACT_VALIDATOR="agent/scripts/check/validate-artifact.py"

# shellcheck source=/dev/null
. "${SCRIPT_DIR}/lib/common.sh"

cd "${ROOT_DIR}"
mkdir -p "${EXEC_DIR}"

for required in "${EXECUTION_CONFIG}" "${PLAN_FILE}" "${WORKFLOW_STATE_FILE}" "${WORKFLOW_POLICY_FILE}"; do
  if [ ! -f "${required}" ]; then
    echo "Required file missing: ${required}" >&2
    exit 21
  fi
done

if [ ! -x "${ITEM_CHECK_SCRIPT}" ]; then
  echo "Missing execution item check script: ${ITEM_CHECK_SCRIPT}" >&2
  exit 25
fi

if [ ! -f "${ARTIFACT_VALIDATOR}" ]; then
  echo "Missing artifact validator: ${ARTIFACT_VALIDATOR}" >&2
  exit 34
fi

if [ ! -f "${FINDINGS_FILE}" ]; then
  echo "Findings file not found: ${FINDINGS_FILE}" >&2
  exit 3
fi

if [ ! -s "${FINDINGS_FILE}" ]; then
  echo "Findings file is empty: ${FINDINGS_FILE}" >&2
  exit 4
fi

python3 "${ARTIFACT_VALIDATOR}" extended-review-findings "${FINDINGS_FILE}"

FINDINGS_COUNT="$(python3 - "${FINDINGS_FILE}" <<'PY'
import sys
from pathlib import Path

import yaml

path = Path(sys.argv[1])
data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
items = data.get("items", [])
print(len(items) if isinstance(items, list) else 0)
PY
)"

SELECTION_META="$(python3 - "${FINDINGS_FILE}" "${SELECTION_RAW}" <<'PY'
import re
import sys
from pathlib import Path

import yaml

findings_path = Path(sys.argv[1])
selection_raw = sys.argv[2]

raw = yaml.safe_load(findings_path.read_text(encoding="utf-8")) or {}
items = raw.get("items", [])
if not isinstance(items, list) or len(items) < 1:
    raise SystemExit(f"Findings file must contain non-empty items list: {findings_path}")

width = max(2, len(str(len(items))))
all_ids = [f"F{idx:0{width}d}" for idx in range(1, len(items) + 1)]
valid_ids = set(all_ids)
priority_rank = {"p0": 0, "p1": 1, "p2": 2, "p3": 3}
legacy_modes = {
    "only-p0",
    "only-p1",
    "only-p2",
    "only-p3",
    "through-p0",
    "through-p1",
    "through-p2",
    "through-p3",
}


def normalized_priority(value):
    priority = str(value or "").lower()
    if priority not in priority_rank:
        raise SystemExit(f"Unsupported priority in findings: {value}")
    return priority


def selected_for_priority_mode(mode):
    selected = []
    for idx, finding in enumerate(items, start=1):
        priority = normalized_priority(finding.get("priority") if isinstance(finding, dict) else "")
        if mode.startswith("only-"):
            if priority == mode.replace("only-", ""):
                selected.append(f"F{idx:0{width}d}")
        elif mode.startswith("through-"):
            threshold = mode.replace("through-", "")
            if priority_rank[priority] <= priority_rank[threshold]:
                selected.append(f"F{idx:0{width}d}")
    return selected


def display_id(number):
    try:
        parsed = int(number)
    except ValueError:
        return None
    return f"F{parsed:0{width}d}"


def extract_ids(text):
    found = []
    seen = set()

    def add(match_text):
        candidate = display_id(match_text)
        if candidate and candidate not in seen:
            seen.add(candidate)
            found.append(candidate)

    for match in re.finditer(r"\bf\s*-?\s*0*(\d+)\b", text, flags=re.IGNORECASE):
        add(match.group(1))

    for match in re.finditer(r"(?<![A-Za-z])0*(\d+)\b", text):
        add(match.group(1))

    unknown = [finding_id for finding_id in found if finding_id not in valid_ids]
    if unknown:
        available = ", ".join(all_ids)
        raise SystemExit(
            f"Unknown finding ID(s): {', '.join(unknown)}. Available IDs: {available}"
        )
    return found


selection = selection_raw.strip()
normalized = re.sub(r"\s+", " ", selection.lower())
compact = re.sub(r"[\s_]+", "-", normalized)

none_aliases = {"none", "no", "nothing", "skip", "skip-backlog", "no-items"}
all_aliases = {"all", "everything", "all-findings", "create-all"}

if compact in none_aliases:
    print("none")
    print(0)
    print("")
    raise SystemExit(0)

if compact in all_aliases:
    print("all")
    print(len(all_ids))
    print(",".join(all_ids))
    raise SystemExit(0)

if compact in legacy_modes:
    selected = selected_for_priority_mode(compact)
    print(compact)
    print(len(selected))
    print(",".join(selected))
    raise SystemExit(0)

ids = extract_ids(selection)
has_exclusion = (
    re.search(r"\b(but|except|exclude|excluding|without|minus)\b", normalized)
    is not None
)

if has_exclusion:
    if not ids:
        raise SystemExit(
            "Backlog selection excludes findings but did not name any finding IDs."
        )
    selected = [finding_id for finding_id in all_ids if finding_id not in set(ids)]
    print(f"all-but:{','.join(ids)}")
    print(len(selected))
    print(",".join(selected))
    raise SystemExit(0)

if ids:
    selected = [finding_id for finding_id in all_ids if finding_id in set(ids)]
    print(f"only:{','.join(selected)}")
    print(len(selected))
    print(",".join(selected))
    raise SystemExit(0)

raise SystemExit(
    "Unsupported backlog selection. Use none, all, only F02 F03, all but F01 F03, "
    "or legacy only-p0..only-p3/through-p0..through-p3."
)
PY
)"
MODE="$(printf '%s\n' "${SELECTION_META}" | sed -n '1p')"
SELECTED_COUNT="$(printf '%s\n' "${SELECTION_META}" | sed -n '2p')"
SELECTED_IDS="$(printf '%s\n' "${SELECTION_META}" | sed -n '3p')"

python3 - "${WORKFLOW_STATE_FILE}" "${PLAN_FILE}" <<'PY'
import sys
from pathlib import Path

import yaml

state_path = Path(sys.argv[1])
plan_path = Path(sys.argv[2])
state = yaml.safe_load(state_path.read_text(encoding="utf-8")) or {}
plan = yaml.safe_load(plan_path.read_text(encoding="utf-8")) or {}
phase = ((state.get("current") or {}).get("phase"))
active_id = ((state.get("current") or {}).get("active_plan_id"))
plan_id = plan.get("id")
if phase == "finalized":
    raise SystemExit("Extended review finalize blocked: workflow state is finalized.")
if not isinstance(plan_id, str) or not plan_id.startswith("pb-"):
    raise SystemExit("Extended review finalize blocked: plan id is missing or invalid.")
if active_id not in (None, plan_id):
    raise SystemExit(f"Extended review finalize blocked: active_plan_id ({active_id}) does not match plan id ({plan_id}).")
PY

load_execution_git_settings "${EXECUTION_CONFIG}"
validate_execution_git_settings
ITEM_ID_WIDTH="$(execution_item_id_width "${EXECUTION_CONFIG}")"

if [ "${DRY_RUN_ENABLED}" = "true" ]; then
  echo "FINALIZE_MODE=dry_run"
  if [ "${MODE}" = "none" ]; then
    echo "DRY_RUN=would_keep_plan_state_no_backlog_created"
  else
    echo "DRY_RUN=would_create_open_items_from ${FINDINGS_FILE} selection=${MODE} selected_ids=${SELECTED_IDS}"
    echo "DRY_RUN=would_update_workflow_state phase=execute_items"
  fi
  if [ "${COMMIT_ENABLED}" = "true" ] && [ "${MODE}" != "none" ]; then
    echo "DRY_RUN=would_git_commit docs: create backlog from ${REVIEW_TASK} findings"
  fi
  if [ "${PUSH_ENABLED}" = "true" ] && [ "${MODE}" != "none" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      echo "DRY_RUN=would_git_pull_rebase"
    fi
    echo "DRY_RUN=would_git_push"
  fi
  echo "CREATED_OPEN_ITEMS=DRY_RUN"
  exit 0
fi

if [ "${MODE}" = "none" ]; then
  rm -f "${FINDINGS_FILE}"
  run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
    --telemetry-file "${TELEMETRY_FILE}" \
    --plan-file "${PLAN_FILE_FOR_TELEMETRY}" \
    record-event \
    --task "${REVIEW_TASK}" \
    --event-type "extended_review_outcome" \
    --outcome "none" \
    --findings-count "${FINDINGS_COUNT}" \
    --created-open-items 0 \
    --selected-mode "${MODE}"
  echo "CREATED_OPEN_ITEMS=0"
  echo "SELECTED_MODE=${MODE}"
  echo "SELECTED_COUNT=${SELECTED_COUNT}"
  echo "SELECTED_FINDINGS=${SELECTED_IDS}"
  exit 0
fi

if [ "${COMMIT_ENABLED}" = "false" ] && [ "${SELECTED_COUNT}" -gt 0 ]; then
  echo "Commit disabled and selection requires item creation. Enable commits or use selection=none." >&2
  exit 26
fi

PLAN_ID="$(extract_plan_id_yaml "${PLAN_FILE}" || true)"

CREATED_COUNT="$(python3 - "${FINDINGS_FILE}" "${EXEC_DIR}" "${PLAN_ID}" "${REVIEW_TASK}" "${MODE}" "${ITEM_ID_WIDTH}" <<'PY'
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

findings_path = Path(sys.argv[1])
exec_dir = Path(sys.argv[2])
plan_id = sys.argv[3]
review_task = sys.argv[4]
mode = sys.argv[5]
item_width = int(sys.argv[6])

raw = yaml.safe_load(findings_path.read_text(encoding="utf-8")) or {}
items = raw.get("items", [])
if not isinstance(items, list) or len(items) < 1:
    raise SystemExit(f"Findings file must contain non-empty items list: {findings_path}")

priority_rank = {"p0": 0, "p1": 1, "p2": 2, "p3": 3}
display_width = max(2, len(str(len(items))))
selected_ids = set()
excluded_ids = set()
if mode.startswith("only:"):
    selected_ids = {part for part in mode.split(":", 1)[1].split(",") if part}
if mode.startswith("all-but:"):
    excluded_ids = {part for part in mode.split(":", 1)[1].split(",") if part}

def display_id(idx: int) -> str:
    return f"F{idx:0{display_width}d}"

def include(idx: int, prio: str) -> bool:
    p = (prio or "").lower()
    if p not in priority_rank:
        raise SystemExit(f"Unsupported priority in findings: {prio}")
    if mode == "all":
        return True
    if mode.startswith("only:"):
        return display_id(idx) in selected_ids
    if mode.startswith("all-but:"):
        return display_id(idx) not in excluded_ids
    if mode.startswith("only-"):
        return p == mode.replace("only-", "")
    if mode.startswith("through-"):
        threshold = mode.replace("through-", "")
        return priority_rank[p] <= priority_rank[threshold]
    return False

id_pattern = re.compile(rf"^(open|review|done)-item-(\d{{{item_width}}})\.yaml$")
existing_ids = []
existing_sources = set()
for p in exec_dir.glob("*item-*.yaml"):
    m = id_pattern.match(p.name)
    if m:
        existing_ids.append(int(m.group(2)))
    try:
        payload = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    except Exception:
        payload = {}
    feedback_entries = payload.get("review_feedback", []) if isinstance(payload, dict) else []
    if isinstance(feedback_entries, list):
        for feedback in feedback_entries:
            if not isinstance(feedback, dict):
                continue
            source = feedback.get("source")
            if isinstance(source, str) and source.strip():
                existing_sources.add(source.strip())
next_id = (max(existing_ids) + 1) if existing_ids else 1

created = 0
for idx, finding in enumerate(items, start=1):
    if not isinstance(finding, dict):
        raise SystemExit("Each findings entry must be an object")

    prio = str(finding.get("priority", "")).lower()
    if not include(idx, prio):
        continue

    draft = finding.get("proposed_backlog_item", {}) or {}
    title = str(draft.get("title", "")).strip()
    intent_outcome = str(draft.get("intent_outcome", "")).strip()
    rationale = str(draft.get("rationale", "")).strip()
    plan_item_required = draft.get("plan_item_required", True)
    plan_item_skip_reason_raw = draft.get("plan_item_skip_reason")
    scope_in = draft.get("scope_in", []) or []
    scope_out = draft.get("scope_out", []) or []
    constraints = draft.get("constraints", []) or []
    inputs = draft.get("inputs", {}) or {}
    req_inputs = inputs.get("required", []) or []
    opt_inputs = inputs.get("optional", []) or []
    acs = draft.get("acceptance_criteria", []) or []
    risk_level = str(draft.get("risk_level", "medium"))
    boundary_impact = draft.get("boundary_impact", []) or ["execution"]
    review_focus = draft.get("review_focus", []) or ["check_findings_are_resolved"]

    if not title or not intent_outcome or not rationale:
        raise SystemExit(f"Finding #{idx} is missing required proposed_backlog_item fields")
    if not isinstance(plan_item_required, bool):
        raise SystemExit(
            f"Finding #{idx} proposed_backlog_item.plan_item_required must be a boolean"
        )
    if not plan_item_required:
        plan_item_skip_reason = str(plan_item_skip_reason_raw or "").strip()
        if not plan_item_skip_reason:
            raise SystemExit(
                f"Finding #{idx} proposed_backlog_item.plan_item_skip_reason must be non-empty when plan_item_required is false"
            )
    else:
        plan_item_skip_reason = None
    if not scope_in or not scope_out or not constraints or not req_inputs or not acs:
        raise SystemExit(f"Finding #{idx} has incomplete proposed_backlog_item structure")

    finding_source = f"{review_task}:{finding.get('id', f'f-{idx:02d}')}"
    if finding_source in existing_sources:
        # Idempotency guard: reruns after partial finalize failure should not
        # duplicate items for already-materialized findings.
        continue

    if next_id >= 10**item_width:
        raise SystemExit(f"Cannot create more execution items: next id would exceed configured width ({item_width}).")

    item_num = f"{next_id:0{item_width}d}"
    payload = {
        "version": 1,
        "kind": "backlog_item",
        "item": {
            "id": f"{plan_id}-item-{item_num}",
            "title": title,
            "status_hint": "open",
            "source": {
                "type": "extended_review",
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
            "plan_item_required": plan_item_required,
            "plan_item_skip_reason": plan_item_skip_reason,
            "risk_level": risk_level,
            "boundary_impact": boundary_impact,
        },
        "handoff": {
            "review_focus": review_focus,
        },
        "review_feedback": [
            {
                "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "source": finding_source,
                "notes": str(finding.get("summary", "")),
            }
        ],
    }

    target = exec_dir / f"open-item-{item_num}.yaml"
    target.write_text(yaml.safe_dump(payload, sort_keys=False), encoding="utf-8")

    existing_sources.add(finding_source)
    next_id += 1
    created += 1

print(created)
PY
)"

if [ "${CREATED_COUNT}" -gt 0 ]; then
  # Enforce policy evidence gate for refine_plan -> execute_items:
  # - at_least_one_open_item_exists
  validate_workflow_transition_gate_from_items "${WORKFLOW_POLICY_FILE}" "refine_plan" "execute_items" "${EXEC_DIR}"
  reconcile_workflow_state_from_items "${WORKFLOW_STATE_FILE}" "${EXEC_DIR}" "execute_items" "${PLAN_ID}" "extended_review_findings_selected" "agent/execution/plan.yaml"

  ${ITEM_CHECK_SCRIPT}
fi

run_telemetry_command "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" \
  --telemetry-file "${TELEMETRY_FILE}" \
  --plan-file "${PLAN_FILE_FOR_TELEMETRY}" \
  record-event \
  --task "${REVIEW_TASK}" \
  --event-type "extended_review_outcome" \
  --outcome "applied" \
  --findings-count "${FINDINGS_COUNT}" \
  --created-open-items "${CREATED_COUNT}" \
  --selected-mode "${MODE}"

record_task_run_finished "${EXECUTION_CONFIG}" "${TELEMETRY_SCRIPT}" "${TELEMETRY_FILE}" "${PLAN_FILE_FOR_TELEMETRY}" "${REVIEW_TASK}"

git add -A
if git diff --cached --quiet; then
  rm -f "${FINDINGS_FILE}"
  echo "No staged changes detected after extended review finalize actions."
  echo "CREATED_OPEN_ITEMS=${CREATED_COUNT}"
  echo "SELECTED_MODE=${MODE}"
  echo "SELECTED_COUNT=${SELECTED_COUNT}"
  echo "SELECTED_FINDINGS=${SELECTED_IDS}"
  exit 0
fi

run_write_command "${EXECUTION_CONFIG}" "would_git_commit docs: create backlog from ${REVIEW_TASK} findings" \
  git commit -m "docs: create backlog from ${REVIEW_TASK} findings"

run_push_if_enabled "${EXECUTION_CONFIG}"

rm -f "${FINDINGS_FILE}"

echo "CREATED_OPEN_ITEMS=${CREATED_COUNT}"
echo "SELECTED_MODE=${MODE}"
echo "SELECTED_COUNT=${SELECTED_COUNT}"
echo "SELECTED_FINDINGS=${SELECTED_IDS}"
