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

plan_path_from_item() {
  item_path="$1"
  item_dir="$(dirname "$item_path")"
  item_base="$(basename "$item_path")"
  plan_base="$(printf '%s' "$item_base" | sed 's/^open-item-/plan-item-/')"
  printf '%s/%s\n' "$item_dir" "$plan_base"
}

ITEM="$(find agent/execution -type f -name 'open-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No open item found." >&2
  exit 10
fi

PLAN_PATH="$(plan_path_from_item "${ITEM}")"

cat <<'OUT'
TASK=plan-item
OUT

echo "ITEM=${ITEM}"
echo "PLAN=${PLAN_PATH}"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/templates/plan-item-template.md"
require_file "${ITEM}"
echo "WRITE=${PLAN_PATH}"

cat <<OUT
INSTRUCTION=Create or update the optional plan for the selected open item at ${PLAN_PATH}. Keep the plan lightweight and implementation-oriented. The plan should guide implementation but must not change item scope or acceptance criteria. When changes are complete, execute scripts/finalize-plan-item.sh ${PLAN_PATH}.
OUT
