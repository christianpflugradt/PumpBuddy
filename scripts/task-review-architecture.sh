#!/usr/bin/env bash
set -euo pipefail

emit_execution_loads() {
  find agent/execution -type f -name '*.md' 2>/dev/null | sort || true
}

cat <<'OUT'
TASK=review-architecture
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/capabilities.md
LOAD=agent/design/use-cases.md
LOAD=agent/design/domain-model.md
LOAD=agent/design/api-contract.md
OUT

while IFS= read -r path; do
  [ -n "$path" ] && echo "LOAD=${path}"
done < <(emit_execution_loads)

cat <<'OUT'
INSTRUCTION=Review architecture boundaries, layering, dependency direction, and separation of concerns against intended structure. Report architectural drift and structural risks only.
OUT
