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

count_matching() {
  pattern="$1"
  find agent/execution -type f -name "$pattern" 2>/dev/null | wc -l | tr -d ' '
}

DONE_COUNT="$(count_matching 'done-item-*.md')"
OPEN_COUNT="$(count_matching 'open-item-*.md')"
REVIEW_COUNT="$(count_matching 'review-item-*.md')"

if [ "${DONE_COUNT}" -lt 1 ]; then
  echo "Finalize blocked: at least one done item is required." >&2
  exit 30
fi

if [ "${OPEN_COUNT}" -ne 0 ] || [ "${REVIEW_COUNT}" -ne 0 ]; then
  echo "Finalize blocked: open or review items still exist." >&2
  exit 31
fi

cat <<'OUT'
TASK=finalize-plan
OUT

require_file "agent/strategy/plan.md"
require_file "agent/templates/plan-template.md"
require_file "agent/templates/finalize-plan-findings-template.md"

find agent/execution -type f -name '*item-*.md' 2>/dev/null | sort | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

cat <<'OUT'
INSTRUCTION=Before finalizing, ask the stakeholder whether the completed plan is acceptance-ready. Do not archive immediately. If the stakeholder approves, ensure plan.md contains both '# Plan: <Name>' and a non-empty '## Plan ID' value, then run: agent/scripts/finalize-plan.sh. If the stakeholder rejects the result, capture each blocking finding as a separate execution-item draft in agent/tmp/finalize-plan-findings.md using agent/templates/finalize-plan-findings-template.md, then run: agent/scripts/finalize-plan-return.sh agent/tmp/finalize-plan-findings.md. Rejection must keep the current plan active, must not archive anything, and must turn the stakeholder findings into new open-item files so the normal plan-item/implement-item/review-item loop can continue. If approval is granted, the archive folder will be created as archive/<plan-id>_<plan-name-with-hyphens> (lowercase). Finalization succeeds only if at least one done item exists and no open/review items remain.
OUT
