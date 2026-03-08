#!/usr/bin/env bash
set -euo pipefail

emit_execution_loads() {
  find agent/execution -type f -name '*.md' 2>/dev/null | sort || true
}

cat <<'OUT'
TASK=review-consistency
LOAD=agent/strategy/milestones.md
LOAD=agent/strategy/capabilities.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/test-strategy.md
LOAD=agent/design/use-cases.md
LOAD=agent/design/domain-model.md
LOAD=agent/design/api-contract.md
OUT

while IFS= read -r path; do
  [ -n "$path" ] && echo "LOAD=${path}"
done < <(emit_execution_loads)

cat <<'OUT'
INSTRUCTION=Review consistency across milestone intent, execution items, and implementation state. Focus only on cross-artifact alignment and drift detection. Do not perform deep architecture, technology, quality, or security evaluation in this task.
OUT
