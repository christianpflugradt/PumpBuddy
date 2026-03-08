#!/usr/bin/env bash
set -euo pipefail

ITEM="$(find agent/execution -type f -name 'open-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No open item found." >&2
  exit 10
fi

cat <<EOF
TASK=implement-item
ITEM=${ITEM}
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/test-strategy.md
LOAD=agent/strategy/tech-stack.md
LOAD=${ITEM}
WRITE=agent/tmp/implement-item-commit-message.txt
INSTRUCTION=Implement the selected item. Use the listed files as the initial context. Load only directly referenced strategy or design files if needed. When implementation is complete, write the commit message to agent/tmp/implement-item-commit-message.txt and execute scripts/finalize-implement-item.sh ${ITEM}
EOF
