#!/usr/bin/env bash
set -euo pipefail

cat <<EOF
TASK=refine-milestone
LOAD=agent/strategy/milestones.md
LOAD=agent/strategy/capabilities.md
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
LOAD=agent/strategy/test-strategy.md
LOAD=agent/design/use-cases.md
LOAD=agent/design/domain-model.md
LOAD=agent/design/api-contract.md
LOAD=agent/templates/item-template.md
INSTRUCTION=Refine the currently active milestone into small execution items. Create implementation-ready item files using the item template. Keep items narrow enough to implement and review in one step.
EOF
