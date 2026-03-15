#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/tasks.sh <task-name|alias|1-6>" >&2
  exit 2
fi

RAW_TASK="$1"
TASK="$(printf '%s' "${RAW_TASK}" | tr '[:upper:]' '[:lower:]')"

resolve_core_task_alias() {
  value="$1"
  case "${value}" in
    1|discuss|go|discuss-plan)
      printf '%s\n' "discuss-plan"
      ;;
    2|refine|split|refine-plan)
      printf '%s\n' "refine-plan"
      ;;
    3|plan|plan-item)
      printf '%s\n' "plan-item"
      ;;
    4|implement|do|implement-item)
      printf '%s\n' "implement-item"
      ;;
    5|review|see|review-item)
      printf '%s\n' "review-item"
      ;;
    6|finalize|end|finalize-plan)
      printf '%s\n' "finalize-plan"
      ;;
    *)
      printf '%s\n' "${value}"
      ;;
  esac
}

TASK="$(resolve_core_task_alias "${TASK}")"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TASK_SCRIPT="${SCRIPT_DIR}/task-${TASK}.sh"

normalize_plan_file() {
  input_path="$1"
  output_path="$2"
  awk '
    BEGIN { in_id=0; replaced=0 }
    {
      if ($0 == "## Plan ID") {
        print
        in_id=1
        next
      }
      if (in_id == 1 && replaced == 0 && NF == 0) {
        print
        next
      }
      if (in_id == 1 && replaced == 0) {
        print "__PLAN_ID__"
        replaced=1
        in_id=0
        next
      }
      print
    }
    END {
      if (in_id == 1 && replaced == 0) {
        print "__PLAN_ID__"
      }
    }
  ' "${input_path}" > "${output_path}"
}

has_execution_items() {
  if [ ! -d "agent/execution" ]; then
    return 1
  fi
  first_item="$(find agent/execution -type f -name '*item-*.md' -print -quit 2>/dev/null || true)"
  [ -n "${first_item}" ]
}

plan_differs_from_template_ignoring_id() {
  plan_file="agent/strategy/plan.md"
  template_file="agent/templates/plan-template.md"

  if [ ! -f "${plan_file}" ] || [ ! -f "${template_file}" ]; then
    return 1
  fi

  tmp_plan="$(mktemp)"
  tmp_template="$(mktemp)"
  cleanup_plan_cmp() {
    rm -f "${tmp_plan}" "${tmp_template}"
  }
  trap cleanup_plan_cmp EXIT INT TERM

  normalize_plan_file "${plan_file}" "${tmp_plan}"
  normalize_plan_file "${template_file}" "${tmp_template}"

  if cmp -s "${tmp_plan}" "${tmp_template}"; then
    trap - EXIT INT TERM
    cleanup_plan_cmp
    return 1
  fi

  trap - EXIT INT TERM
  cleanup_plan_cmp
  return 0
}

enforce_discuss_plan_start_state() {
  if [ "${TASK}" != "discuss-plan" ]; then
    return 0
  fi

  if has_execution_items || plan_differs_from_template_ignoring_id; then
    echo "Discuss-plan blocked: active plan still in progress. Finalize or clear the current plan lifecycle before starting a new plan discussion." >&2
    exit 32
  fi
}

if [ ! -f "${TASK_SCRIPT}" ]; then
  echo "Unknown task: ${TASK}" >&2
  exit 3
fi

STATE_VALIDATOR="${SCRIPT_DIR}/validate-execution-state.sh"
if [ -f "${STATE_VALIDATOR}" ]; then
  "${STATE_VALIDATOR}"
fi

ITEM_LINTER="${SCRIPT_DIR}/validate-item-content.sh"
if [ -f "${ITEM_LINTER}" ]; then
  "${ITEM_LINTER}"
fi

enforce_discuss_plan_start_state

OUTPUT="$("${TASK_SCRIPT}")"
printf '%s\n' "${OUTPUT}"

TASK_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^TASK=//p' | head -n 1)"
ITEM_NAME="$(printf '%s\n' "${OUTPUT}" | sed -n 's/^ITEM=//p' | head -n 1)"
LOAD_COUNT="$(printf '%s\n' "${OUTPUT}" | grep -c '^LOAD=' || true)"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
METRICS_DIR="agent/tmp"
METRICS_FILE="${METRICS_DIR}/task-metrics.log"

mkdir -p "${METRICS_DIR}"
printf '%s task=%s item=%s loads=%s\n' "${TIMESTAMP}" "${TASK_NAME:-unknown}" "${ITEM_NAME:-none}" "${LOAD_COUNT}" >> "${METRICS_FILE}"
