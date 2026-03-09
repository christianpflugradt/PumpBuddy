#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/finalize-plan-item.sh <plan-item-path>" >&2
  exit 2
fi

PLAN_PATH="$1"

if [ ! -f "${PLAN_PATH}" ]; then
  echo "Plan item file not found: ${PLAN_PATH}" >&2
  exit 3
fi

if [ -z "$(git status --porcelain "${PLAN_PATH}")" ]; then
  echo "No changes detected for plan item: ${PLAN_PATH}" >&2
  exit 4
fi

PLAN_BASE="$(basename "${PLAN_PATH}")"
ITEM_ID="$(printf '%s' "${PLAN_BASE}" | sed -n 's/^plan-item-\([0-9][0-9]*\)\.md$/\1/p')"

git add "${PLAN_PATH}"
if [ -n "${ITEM_ID}" ]; then
  git commit -m "docs: update optional plan item ${ITEM_ID}"
else
  git commit -m "docs: update optional plan item"
fi
git push

echo "PLAN_ITEM_FINALIZED=${PLAN_PATH}"
