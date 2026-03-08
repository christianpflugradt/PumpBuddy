#!/usr/bin/env bash
set -euo pipefail

cat <<EOF
TASK=review-architecture
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/test-strategy.md
LOAD=agent/design/use-cases.md
LOAD=agent/design/domain-model.md
LOAD=agent/design/api-contract.md
INSTRUCTION=Review the current implementation for architectural alignment. Focus on boundaries, layering, testability, operational shape, and structural risks. Suggest follow-up work when needed.
EOF
