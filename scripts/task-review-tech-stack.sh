#!/usr/bin/env bash
set -euo pipefail

cat <<EOF
TASK=review-tech-stack
LOAD=agent/strategy/tech-stack.md
INSTRUCTION=Review the repository for adherence to the defined tech stack. Check for stack drift, forbidden technologies, and deviations from the declared architectural constraints.
EOF
