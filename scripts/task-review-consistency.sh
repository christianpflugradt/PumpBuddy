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

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' -o -name 'done-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-consistency
OUT

require_file "agent/strategy/milestones.md"
require_file "agent/strategy/capabilities.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
require_file "agent/design/api-contract.md"

while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done < <(emit_item_loads)

cat <<'OUT'
INSTRUCTION=Review consistency across active milestone intent, execution items, and implementation state. Focus only on cross-artifact alignment and drift detection. Do not perform deep architecture, technology, quality, or security evaluation in this task.
OUT
