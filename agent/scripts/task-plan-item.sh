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

OPEN_ITEMS="$(find agent/execution -type f -name 'open-item-*.md' | sort || true)"

if [ -z "${OPEN_ITEMS}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM="$(printf '%s\n' "${OPEN_ITEMS}" | head -n 1)"

for candidate in ${OPEN_ITEMS}; do
  candidate_plan="$(plan_path_from_item "${candidate}")"
  if [ ! -f "${candidate_plan}" ]; then
    ITEM="${candidate}"
    break
  fi
done

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

require_file "agent/templates/task-output-template.md"
cat <<OUT
INSTRUCTION=Create or update the optional plan for the selected open item at ${PLAN_PATH}. Keep the plan lightweight and implementation-oriented. The plan should guide implementation but must not change item scope or acceptance criteria. When changes are complete, execute agent/scripts/finalize-plan-item.sh ${PLAN_PATH}. Use the output format from agent/templates/task-output-template.md exactly; respond with only `Status:`, `Task:`, `Workspace:` and optional `Context:` lines, omitting `Context:` when none applies. If `Status:` is not `SUCCESS`, include `Reason:` on up to 3 lines describing why.
OUT

