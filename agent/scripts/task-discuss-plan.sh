#!/usr/bin/env sh
set -eu

require_file() {
  path="$1"
  if [ ! -f "$path" ]; then
    echo "Required file missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
}

emit_optional_load() {
  path="$1"
  if [ -f "$path" ]; then
    echo "LOAD=$path"
  fi
  return 0
}

extract_plan_id() {
  plan_file="$1"
  awk '
    /^## Plan ID$/ { in_id=1; next }
    in_id == 1 && NF > 0 { print; exit }
  ' "${plan_file}"
}

compute_next_plan_id_from_archive() {
  archive_root="$1"
  max_num=0
  max_width=3

  if [ -d "${archive_root}" ]; then
    find "${archive_root}" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | while IFS= read -r dir; do
      base="$(basename "${dir}")"
      id_part="${base%%_*}"
      case "${id_part}" in
        pb-[0-9]*)
          num="${id_part#pb-}"
          case "${num}" in
            ''|*[!0-9]*)
              continue
              ;;
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
      END {
        printf "%s %s\n", max_num, max_width
      }
    '
  else
    printf "0 3\n"
  fi
}

cat <<'OUT'
TASK=discuss-plan
OUT

require_file "agent/strategy/plan.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/security-baseline.md"
require_file "agent/strategy/security.md"
emit_optional_load "agent/design/use-cases.md"
emit_optional_load "agent/design/domain-model.md"
emit_optional_load "agent/strategy/capabilities.md"

CURRENT_PLAN_ID="$(extract_plan_id "agent/strategy/plan.md" || true)"
NEXT_META="$(compute_next_plan_id_from_archive "archive")"
NEXT_PLAN_NUM="$(printf '%s' "${NEXT_META}" | awk '{ print $1 }')"
NEXT_PLAN_WIDTH="$(printf '%s' "${NEXT_META}" | awk '{ print $2 }')"
NEXT_PLAN_ID="$(printf "pb-%0${NEXT_PLAN_WIDTH}d" "$((NEXT_PLAN_NUM + 1))")"

RESOLVED_PLAN_ID="${NEXT_PLAN_ID}"
case "${CURRENT_PLAN_ID}" in
  pb-[0-9]*)
    RESOLVED_PLAN_ID="${CURRENT_PLAN_ID}"
    ;;
esac

echo "PLAN_ID_CURRENT=${CURRENT_PLAN_ID:-unknown}"
echo "PLAN_ID_SUGGESTED=${RESOLVED_PLAN_ID}"

cat <<'OUT'
INSTRUCTION=Discuss and shape the active plan with the stakeholder before refinement. Start by asking the stakeholder for their initial proposal; do not proactively propose scope/content unless the stakeholder explicitly asks for suggestions. Drive the conversation with focused questions while keeping room for full stakeholder input. Estimate likely refinement size and steer toward a target of 4-8 execution items. If scope appears below 4 items, suggest adding meaningful outcomes. If scope appears above 8 items, suggest splitting into multiple plans. Use PLAN_ID_SUGGESTED when plan ID is missing/placeholder/unclear, and confirm it with the stakeholder. Update agent/strategy/plan.md to reflect the agreed scope, outcomes, constraints, clear success criteria, and confirmed plan ID. Do not create execution item files in this task.
OUT
