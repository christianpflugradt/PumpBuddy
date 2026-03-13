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

emit_reference_load() {
  path="$1"
  if [ -e "$path" ]; then
    echo "LOAD=$path"
    return 0
  fi
  echo "NOTE=Reference missing (continuing): $path" >&2
  return 0
}

plan_path_from_item() {
  item_path="$1"
  item_dir="$(dirname "$item_path")"
  item_base="$(basename "$item_path")"
  plan_base="$(printf '%s' "$item_base" | sed 's/^open-item-/plan-item-/')"
  printf '%s/%s\n' "$item_dir" "$plan_base"
}

emit_reference_loads() {
  item_path="$1"
  in_refs="0"
  while IFS= read -r line; do
    case "${line}" in
      "## References")
        in_refs="1"
        continue
        ;;
      "## "*)
        if [ "${in_refs}" = "1" ]; then
          break
        fi
        ;;
    esac

    if [ "${in_refs}" = "1" ]; then
      ref_path="$(printf '%s\n' "${line}" | sed -n 's/^[[:space:]]*-[[:space:]]*`\([^`][^`]*\)`[[:space:]]*$/\1/p')"
      if [ -z "${ref_path}" ]; then
        ref_path="$(printf '%s\n' "${line}" | sed -n 's/^[[:space:]]*-[[:space:]]*\([^`[:space:]][^[:space:]]*\)[[:space:]]*$/\1/p')"
      fi
      [ -n "${ref_path}" ] && emit_reference_load "${ref_path}"
    fi
  done < "${item_path}"
}

ITEM="$(find agent/execution -type f -name 'open-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM_BASE="$(basename "${ITEM}")"
ITEM_ID="$(printf '%s' "${ITEM_BASE}" | sed -n 's/^open-item-\([0-9][0-9]\)\.md$/\1/p')"
if [ -z "${ITEM_ID}" ]; then
  echo "Could not determine item id from filename: ${ITEM_BASE}" >&2
  exit 11
fi

cat <<'OUT'
TASK=implement-item
OUT

echo "ITEM=${ITEM}"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/tech-stack.md"
require_file "${ITEM}"
emit_reference_loads "${ITEM}"
PLAN_PATH="$(plan_path_from_item "${ITEM}")"
if [ -f "${PLAN_PATH}" ]; then
  require_file "${PLAN_PATH}"
fi

echo "WRITE=agent/tmp/implement-item-commit-message.txt"
require_file "agent/templates/task-output-template.md"
cat <<OUT
INSTRUCTION=Implement the selected item. If an optional plan file is loaded, use it as implementation guidance without changing item scope or acceptance criteria. If no plan file is present, perform planning and implementation in one pass. Load only directly referenced strategy or design files if needed. Defer runnable verification until the end of the task whenever practical; prefer one targeted final quality pass for the changed code area, and skip codebase tests entirely when the change does not affect backend or renderer code. When implementation is complete, write the commit message to agent/tmp/implement-item-commit-message.txt and execute agent/scripts/finalize-implement-item.sh ${ITEM_ID} Use the output format from agent/templates/task-output-template.md exactly; respond with only `Status:`, `Task:`, `Workspace:` and optional `Context:` lines, omitting `Context:` when none applies. If `Status:` is not `SUCCESS`, include `Reason:` on up to 3 lines describing why.
OUT

