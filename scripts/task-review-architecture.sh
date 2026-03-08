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
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-architecture
OUT

require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/capabilities.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
require_file "agent/design/api-contract.md"

while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done < <(emit_item_loads)

cat <<'OUT'
INSTRUCTION=Review architecture boundaries, layering, dependency direction, and separation of concerns against intended structure. Report architectural drift and structural risks only.
OUT
