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

emit_api_contract_loads() {
  find agent/design -maxdepth 1 -type f -name 'api-contract*.yaml' | sort 2>/dev/null || true
}

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' -o -name 'done-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-architecture
OUT

require_file "agent/strategy/plan.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
emit_optional_load "agent/strategy/capabilities.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
emit_api_contract_loads | while IFS= read -r path; do
  if [ -n "$path" ]; then
    emit_optional_load "$path"
  fi
done

emit_item_loads | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

cat <<'OUT'
INSTRUCTION=Review architecture boundaries, layering, dependency direction, and separation of concerns against intended structure. Report architectural drift and structural risks only.
OUT
