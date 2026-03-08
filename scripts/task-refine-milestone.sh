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

cat <<'OUT'
TASK=refine-milestone
OUT

require_file "agent/strategy/milestones.md"
require_file "agent/strategy/capabilities.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/security.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
require_file "agent/design/api-contract.md"
require_file "agent/templates/item-template.md"

cat <<'OUT'
INSTRUCTION=Refine the active milestone into small execution items. Create implementation-ready item files using the item template. Keep items narrow enough to implement and review in one step.
OUT
