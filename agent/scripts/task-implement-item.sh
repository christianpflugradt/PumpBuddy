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
      [ -n "${ref_path}" ] && require_file "${ref_path}"
    fi
  done < "${item_path}"
}

ITEM="$(find agent/execution -type f -name 'open-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No open item found." >&2
  exit 10
fi

ITEM_BASE="$(basename "${ITEM}")"
ITEM_ID="$(printf '%s' "${ITEM_BASE}" | sed -n 's/^open-item-\([0-9][0-9]*\)\.md$/\1/p')"
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
cat <<OUT
INSTRUCTION=Implement the selected item. If an optional plan file is loaded, use it as implementation guidance without changing item scope or acceptance criteria. If no plan file is present, perform planning and implementation in one pass. Load only directly referenced strategy or design files if needed. When implementation is complete, write the commit message to agent/tmp/implement-item-commit-message.txt and execute agent/scripts/finalize-implement-item.sh ${ITEM_ID}
OUT
