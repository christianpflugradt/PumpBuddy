#!/usr/bin/env sh
set -eu

if [ -z "$(git status --porcelain agent/execution)" ]; then
  echo "No execution item changes detected under agent/execution." >&2
  exit 3
fi

git add agent/execution
git commit -m "docs: refine plan into execution items"
git push

echo "REFINE_PLAN_FINALIZED=1"
