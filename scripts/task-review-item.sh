#!/usr/bin/env bash
set -euo pipefail

require_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    echo "Required file missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
}

ITEM="$(find agent/execution -type f -name 'review-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No review item found." >&2
  exit 11
fi

cat <<'OUT'
TASK=review-item
OUT

echo "ITEM=${ITEM}"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/tech-stack.md"
require_file "${ITEM}"

echo "WRITE=agent/tmp/review-item-findings.md"
cat <<OUT
INSTRUCTION=Review the selected item. Validate goal, scope, acceptance criteria, and alignment with the listed constraints. If acceptable, execute scripts/finalize-review-accept-item.sh ${ITEM}. If not acceptable, write concrete findings to agent/tmp/review-item-findings.md and execute scripts/finalize-review-return-item.sh ${ITEM} agent/tmp/review-item-findings.md.
OUT
