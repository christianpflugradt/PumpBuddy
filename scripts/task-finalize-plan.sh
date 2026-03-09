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

find agent/execution -type f -name '*item-*.md' 2>/dev/null | sort | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

cat <<'OUT'
INSTRUCTION=Finalize the active plan by archiving plan.md and all work item files. Choose a plan ID and run: scripts/finalize-plan.sh <plan-id>. The command succeeds only if at least one done item exists and no open/review items remain.
OUT
