#!/usr/bin/env sh
set -eu

require_file() {
  path="$1"
  if [ ! -e "$path" ]; then
    echo "Required path missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
}

emit_optional_load() {
  path="$1"
  if [ -e "$path" ]; then
    echo "LOAD=$path"
  fi
}

extract_plan_id_yaml() {
  plan_file="$1"
  python3 - "$plan_file" <<'PY'
import sys
try:
    import yaml
except Exception:
    print("")
    raise SystemExit(0)

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as h:
        data = yaml.safe_load(h) or {}
except Exception:
    print("")
    raise SystemExit(0)
plan_id = data.get("id", "")
print(plan_id if isinstance(plan_id, str) else "")
PY
}

compute_next_plan_id_from_archive() {
  archive_root="$1"

  if [ -d "${archive_root}" ]; then
    find "${archive_root}" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | while IFS= read -r dir; do
      base="$(basename "${dir}")"
      id_part="${base%%_*}"
      case "${id_part}" in
        pb-[0-9]*)
          num="${id_part#pb-}"
          case "${num}" in
            ''|*[!0-9]*) continue ;;
          esac
          width="${#num}"
          num_base10="$(printf '%s' "${num}" | sed 's/^0*//')"
          if [ -z "${num_base10}" ]; then
            num_base10=0
          fi
          printf '%s %s\n' "${num_base10}" "${width}"
          ;;
      esac
    done | awk '
      BEGIN { max_num=0; max_width=3 }
      {
        if ($1 > max_num) {
          max_num=$1
          max_width=$2
        }
      }
      END { printf "%s %s\n", max_num, max_width }
    '
  else
    printf '0 3\n'
  fi
}

read_execution_flag() {
  config_path="$1"
  dotted_key="$2"
  default_value="$3"
  python3 - "$config_path" "$dotted_key" "$default_value" <<'PY'
import sys
try:
    import yaml
except Exception:
    print(sys.argv[3])
    raise SystemExit(0)

path, dotted_key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
except Exception:
    print(default)
    raise SystemExit(0)

node = data
for part in dotted_key.split("."):
    if not isinstance(node, dict) or part not in node:
        print(default)
        raise SystemExit(0)
    node = node[part]

if isinstance(node, bool):
    print("true" if node else "false")
else:
    print(default)
PY
}

read_execution_int() {
  config_path="$1"
  dotted_key="$2"
  default_value="$3"
  python3 - "$config_path" "$dotted_key" "$default_value" <<'PY'
import sys
try:
    import yaml
except Exception:
    print(sys.argv[3])
    raise SystemExit(0)

path, dotted_key, default = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, "r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
except Exception:
    print(default)
    raise SystemExit(0)

node = data
for part in dotted_key.split("."):
    if not isinstance(node, dict) or part not in node:
        print(default)
        raise SystemExit(0)
    node = node[part]

if isinstance(node, int) and node > 0:
    print(node)
else:
    print(default)
PY
}

execution_dry_run_enabled() {
  config_path="$1"
  read_execution_flag "${config_path}" "runtime.dry_run" "false"
}

execution_plan_id_width() {
  config_path="$1"
  read_execution_int "${config_path}" "id_format.plan_numeric_length" "3"
}

execution_item_id_width() {
  config_path="$1"
  read_execution_int "${config_path}" "id_format.item_numeric_length" "2"
}

execution_telemetry_enabled() {
  config_path="$1"
  read_execution_flag "${config_path}" "telemetry.enabled" "false"
}

run_telemetry_command() {
  config_path="$1"
  telemetry_script="$2"
  shift 2

  telemetry_enabled="$(execution_telemetry_enabled "${config_path}")"
  if [ "${telemetry_enabled}" != "true" ]; then
    return 0
  fi

  if [ ! -f "${telemetry_script}" ]; then
    return 0
  fi

  python3 "${telemetry_script}" "$@"
}

run_write_command() {
  config_path="$1"
  dry_run_label="$2"
  shift 2

  dry_run_enabled="$(execution_dry_run_enabled "${config_path}")"
  if [ "${dry_run_enabled}" = "true" ]; then
    echo "DRY_RUN=${dry_run_label}"
    return 0
  fi

  "$@"
}

append_line_guarded() {
  config_path="$1"
  target_file="$2"
  line="$3"

  dry_run_enabled="$(execution_dry_run_enabled "${config_path}")"
  if [ "${dry_run_enabled}" = "true" ]; then
    echo "DRY_RUN=would_append_line target=${target_file}" >&2
    return 0
  fi

  printf '%s\n' "${line}" >> "${target_file}"
}

ensure_context_runtime() {
  context_config="$1"
  context_loader="$2"

  if [ ! -f "${context_config}" ]; then
    echo "Missing context config: ${context_config}" >&2
    exit 21
  fi

  if [ ! -x "${context_loader}" ]; then
    echo "Missing context loader: ${context_loader}" >&2
    exit 22
  fi
}

emit_context_loads() {
  context_loader="$1"
  context_config="$2"

  "${context_loader}" --config "${context_config}" --mode loads | while IFS="$(printf '\t')" read -r kind path; do
    case "${kind}" in
      required|template_required)
        require_file "${path}"
        ;;
      optional)
        emit_optional_load "${path}"
        ;;
    esac
  done
}

load_execution_git_settings() {
  execution_config="$1"
  COMMIT_ENABLED="$(read_execution_flag "${execution_config}" "git.commit_enabled" "true")"
  PUSH_ENABLED="$(read_execution_flag "${execution_config}" "git.push_enabled" "true")"
  PULL_REBASE_ENABLED="$(read_execution_flag "${execution_config}" "git.pull_rebase_before_push" "true")"
  DRY_RUN_ENABLED="$(read_execution_flag "${execution_config}" "runtime.dry_run" "false")"
  export COMMIT_ENABLED PUSH_ENABLED PULL_REBASE_ENABLED DRY_RUN_ENABLED
}

validate_execution_git_settings() {
  if [ "${COMMIT_ENABLED}" = "false" ] && [ "${PUSH_ENABLED}" = "true" ]; then
    echo "Invalid execution config: push_enabled=true requires commit_enabled=true." >&2
    exit 24
  fi
}

run_push_if_enabled() {
  execution_config="$1"
  if [ "${PUSH_ENABLED}" = "true" ]; then
    if [ "${PULL_REBASE_ENABLED}" = "true" ]; then
      # Use autostash so task finalizers do not fail when framework-managed
      # workspace files are dirty (for example workflow state reconciliation).
      run_write_command "${execution_config}" "would_git_pull_rebase" git pull -r --autostash
    fi
    run_write_command "${execution_config}" "would_git_push" git push
  fi
}

workspace_cleanliness() {
  git_status="$(git status --porcelain 2>/dev/null || true)"
  if [ -n "${git_status}" ]; then
    printf '%s\n' "DIRTY"
  else
    printf '%s\n' "CLEAN"
  fi
}

emit_task_output_markers() {
  status="$1"
  task_name="$2"
  workspace_state="$(workspace_cleanliness)"
  printf '%s\n' "TASK_OUTPUT_STATUS=${status}"
  printf '%s\n' "TASK_OUTPUT_TASK=${task_name}"
  printf '%s\n' "TASK_OUTPUT_WORKSPACE=${workspace_state}"
}

record_task_run_finished() {
  execution_config="$1"
  telemetry_script="$2"
  telemetry_file="$3"
  plan_file="$4"
  task_name="$5"
  item_id="${6:-}"

  if [ -n "${item_id}" ]; then
    run_telemetry_command "${execution_config}" "${telemetry_script}" \
      --telemetry-file "${telemetry_file}" \
      --plan-file "${plan_file}" \
      record-event \
      --task "${task_name}" \
      --event-type "task_run_finished" \
      --item-id "${item_id}"
  else
    run_telemetry_command "${execution_config}" "${telemetry_script}" \
      --telemetry-file "${telemetry_file}" \
      --plan-file "${plan_file}" \
      record-event \
      --task "${task_name}" \
      --event-type "task_run_finished"
  fi
}

validate_workflow_transition_gate_from_items() {
  workflow_policy_file="$1"
  from_state="$2"
  to_state="$3"
  items_dir="$4"

  python3 - "${workflow_policy_file}" "${from_state}" "${to_state}" "${items_dir}" <<'PY'
import sys
from pathlib import Path

import yaml

policy_path = Path(sys.argv[1])
from_state = sys.argv[2]
to_state = sys.argv[3]
items_dir = Path(sys.argv[4])

policy = yaml.safe_load(policy_path.read_text(encoding="utf-8")) or {}
transitions = (((policy.get("state_machine") or {}).get("transitions")) or [])

target = None
for transition in transitions:
    if not isinstance(transition, dict):
        continue
    if transition.get("from") == from_state and transition.get("to") == to_state:
        target = transition
        break

if target is None:
    raise SystemExit(
        f"Workflow policy transition missing: {from_state} -> {to_state} in {policy_path}"
    )

conditions = target.get("when") or []
if not isinstance(conditions, list):
    raise SystemExit(
        f"Workflow policy transition 'when' must be a list for {from_state} -> {to_state}"
    )

counts = {
    "open": len(list(items_dir.glob("open-item-*.yaml"))),
    "review": len(list(items_dir.glob("review-item-*.yaml"))),
    "done": len(list(items_dir.glob("done-item-*.yaml"))),
}

evidence_eval = {
    "no_open_or_review_items_exist": counts["open"] == 0 and counts["review"] == 0,
    "at_least_one_done_item_exists": counts["done"] >= 1,
    "at_least_one_open_item_exists": counts["open"] >= 1,
}
evidence_conditions = []
unmet = []
for cond in conditions:
    if cond in evidence_eval:
        evidence_conditions.append(cond)
        if not evidence_eval[cond]:
            unmet.append(cond)

if unmet:
    rendered = ", ".join(unmet)
    raise SystemExit(
        f"Workflow transition gate blocked for {from_state} -> {to_state}: unmet [{rendered}] with counts {counts}"
    )

if evidence_conditions:
    rendered = ", ".join(evidence_conditions)
    print(
        f"PASS workflow transition gate {from_state}->{to_state} ({rendered}) with counts {counts}"
    )
else:
    print(
        f"PASS workflow transition gate {from_state}->{to_state} (no evidence-based conditions) with counts {counts}"
    )
PY
}

reconcile_workflow_state_from_items() {
  workflow_state_file="$1"
  items_dir="$2"
  to_phase="$3"
  active_plan_id="$4"
  transition_reason="$5"
  active_plan_path="${6:-agent/execution/plan.yaml}"

  python3 - "${workflow_state_file}" "${items_dir}" "${to_phase}" "${active_plan_id}" "${transition_reason}" "${active_plan_path}" <<'PY'
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

workflow_state_path = Path(sys.argv[1])
items_dir = Path(sys.argv[2])
to_phase = sys.argv[3]
active_plan_id = sys.argv[4]
transition_reason = sys.argv[5]
active_plan_path = sys.argv[6]

data = yaml.safe_load(workflow_state_path.read_text(encoding="utf-8")) or {}
current = data.setdefault("current", {})
item_counters = data.setdefault("item_counters", {})
last = data.setdefault("last_transition", {})

prev = current.get("phase")
current["phase"] = to_phase
current["active_plan_id"] = active_plan_id
current["active_plan_path"] = active_plan_path

item_counters["open"] = len(list(items_dir.glob("open-item-*.yaml")))
item_counters["review"] = len(list(items_dir.glob("review-item-*.yaml")))
item_counters["done"] = len(list(items_dir.glob("done-item-*.yaml")))

effective_to_phase = to_phase
effective_reason = transition_reason

# Keep runtime phase aligned with workflow-policy execute_items -> finalize_plan gate:
# when no open/review items remain and at least one done item exists, the execution
# loop is complete and phase should advance to finalize_plan.
if (
    to_phase == "execute_items"
    and item_counters["open"] == 0
    and item_counters["review"] == 0
    and item_counters["done"] >= 1
):
    effective_to_phase = "finalize_plan"
    if transition_reason == "item_review_accepted":
        effective_reason = "item_review_accepted_finalize_ready"

last["at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
last["from"] = prev
last["to"] = effective_to_phase
last["reason"] = effective_reason

current["phase"] = effective_to_phase

workflow_state_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
}

sync_workflow_state_finalize_readiness() {
  workflow_state_file="$1"
  items_dir="$2"

  python3 - "${workflow_state_file}" "${items_dir}" <<'PY'
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

workflow_state_path = Path(sys.argv[1])
items_dir = Path(sys.argv[2])

data = yaml.safe_load(workflow_state_path.read_text(encoding="utf-8")) or {}
current = data.setdefault("current", {})
item_counters = data.setdefault("item_counters", {})
last = data.setdefault("last_transition", {})

item_counters["open"] = len(list(items_dir.glob("open-item-*.yaml")))
item_counters["review"] = len(list(items_dir.glob("review-item-*.yaml")))
item_counters["done"] = len(list(items_dir.glob("done-item-*.yaml")))

if (
    current.get("phase") == "execute_items"
    and item_counters["open"] == 0
    and item_counters["review"] == 0
    and item_counters["done"] >= 1
):
    current["phase"] = "finalize_plan"
    last["at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    last["from"] = "execute_items"
    last["to"] = "finalize_plan"
    last["reason"] = "auto_reconcile_finalize_ready"

workflow_state_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")
PY
}
