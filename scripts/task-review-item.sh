#!/usr/bin/env bash
set -euo pipefail

ITEM="$(find agent/execution -type f -name 'review-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No review item found." >&2
  exit 11
fi

cat <<EOF
TASK=review-item
ITEM=${ITEM}
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/test-strategy.md
LOAD=agent/strategy/tech-stack.md
LOAD=${ITEM}
INSTRUCTION=Review the selected item. Validate goal, scope, acceptance criteria, and alignment with the listed constraints. If acceptable, move the item from review to done. Otherwise return it to open with clear findings.
EOF
