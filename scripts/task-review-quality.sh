#!/usr/bin/env bash
set -euo pipefail

emit_execution_loads() {
  find agent/execution -type f -name '*.md' 2>/dev/null | sort || true
}

cat <<'OUT'
TASK=review-quality
LOAD=agent/strategy/test-strategy.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/capabilities.md
OUT

while IFS= read -r path; do
  [ -n "$path" ] && echo "LOAD=${path}"
done < <(emit_execution_loads)

cat <<'OUT'
INSTRUCTION=Review milestone quality posture for the current state. Focus on test effectiveness, reliability/error handling, maintainability, and practical performance baseline confidence. Do not perform deep stack governance or security posture review in this task.
OUT
