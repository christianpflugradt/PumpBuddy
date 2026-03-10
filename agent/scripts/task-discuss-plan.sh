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
INSTRUCTION=Discuss and shape the active plan with the stakeholder before refinement using a short, conversational cadence. Start by asking for the stakeholder's initial proposal; do not proactively propose scope/content unless explicitly requested. Keep responses concise and iterative: ask at most 1-3 focused questions per turn, avoid long monologues, and do not produce a full plan draft early. Allow the stakeholder to reveal ideas incrementally, including long-term vision beyond one plan, and help carve out a pragmatic next plan slice. Estimate likely refinement size and steer toward 4-8 execution items. If scope appears below 4 items, suggest adding meaningful outcomes; if scope appears above 8 items, suggest splitting into multiple plans. Only present a full proposed plan summary when the stakeholder explicitly asks for it or when enough information is available and the agent first asks for permission to summarize. Use PLAN_ID_SUGGESTED when plan ID is missing/placeholder/unclear, confirm the ID with the stakeholder, then update agent/strategy/plan.md with the agreed content. Do not create execution item files in this task. Do not suggest or ask to execute the next task (for example refine-plan); keep the discussion focused strictly on plan shaping. When discussion document updates are complete, execute agent/scripts/finalize-discuss-plan.sh to commit and push the changed discussion documents.
OUT
