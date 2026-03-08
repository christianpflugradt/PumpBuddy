#!/usr/bin/env bash
set -euo pipefail

cat <<EOF
TASK=review-consistency
LOAD=agent/strategy/milestones.md
LOAD=agent/strategy/capabilities.md
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/design/use-cases.md
LOAD=agent/design/domain-model.md
LOAD=agent/design/api-contract.md
INSTRUCTION=Review the current project state for consistency between strategy, design, and implementation. Identify drift, contradictions, missing follow-up work, or mismatches between documents and code.
EOF
