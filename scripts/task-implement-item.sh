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

ITEM="$(find agent/execution -type f -name 'open-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No open item found." >&2
  exit 10
fi

cat <<'OUT'
TASK=implement-item
OUT

echo "ITEM=${ITEM}"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/tech-stack.md"
require_file "${ITEM}"

echo "WRITE=agent/tmp/implement-item-commit-message.txt"
cat <<OUT
INSTRUCTION=Implement the selected item. Use the listed files as the initial context. Load only directly referenced strategy or design files if needed. When implementation is complete, write the commit message to agent/tmp/implement-item-commit-message.txt and execute scripts/finalize-implement-item.sh ${ITEM}
OUT
