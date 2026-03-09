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
  [ -f "$path" ] && echo "LOAD=$path"
}

emit_api_contract_loads() {
  find agent/design -maxdepth 1 -type f -name 'api-contract*.yaml' | sort 2>/dev/null || true
}

cat <<'OUT'
TASK=refine-plan
OUT

require_file "agent/strategy/plan.md"
emit_optional_load "agent/strategy/capabilities.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/security-baseline.md"
require_file "agent/strategy/security.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
emit_api_contract_loads | while IFS= read -r path; do
  [ -n "$path" ] && emit_optional_load "$path"
done
require_file "agent/templates/item-template.md"

cat <<'OUT'
INSTRUCTION=Refine the active plan into small execution items. Create implementation-ready item files using the item template. Keep items narrow enough to implement and review in one step. Each item must have exactly one primary deliverable outcome and include at least one executable verification step in acceptance criteria (for example a concrete command or runtime check). Do not modify the plan file during refinement.
OUT
