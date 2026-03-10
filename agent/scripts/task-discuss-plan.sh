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

cat <<'OUT'
TASK=discuss-plan
OUT

require_file "agent/strategy/plan.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/security-baseline.md"
require_file "agent/strategy/security.md"
emit_optional_load "agent/design/use-cases.md"
emit_optional_load "agent/design/domain-model.md"
emit_optional_load "agent/strategy/capabilities.md"

cat <<'OUT'
INSTRUCTION=Discuss and shape the active plan with the stakeholder before refinement. Drive the conversation with focused questions, but keep room for full stakeholder input. Estimate likely refinement size and steer toward a target of 4-8 execution items. If scope appears below 4 items, suggest adding meaningful outcomes. If scope appears above 8 items, suggest splitting into multiple plans. Update agent/strategy/plan.md to reflect the agreed scope, outcomes, constraints, and clear success criteria. Do not create execution item files in this task.
OUT
