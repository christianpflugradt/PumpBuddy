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

require_path() {
  path="$1"
  if [ ! -e "$path" ]; then
    echo "Required path missing: $path" >&2
    exit 20
  fi
  echo "LOAD=$path"
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
      [ -n "${ref_path}" ] && require_path "${ref_path}"
    fi
  done < "${item_path}"
}

ITEM="$(find agent/execution -type f -name 'review-item-*.md' | sort | head -n 1 || true)"

if [ -z "${ITEM}" ]; then
  echo "No review item found." >&2
  exit 11
fi

cat <<'OUT'
TASK=review-item
OUT

echo "ITEM=${ITEM}"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/tech-stack.md"
require_file "${ITEM}"
emit_reference_loads "${ITEM}"
require_file "agent/templates/review-findings-template.md"
require_file "agent/templates/review-accept-template.md"

echo "WRITE=agent/tmp/review-item-findings.md"
echo "WRITE=agent/tmp/review-item-accept.md"
cat <<OUT
INSTRUCTION=Review the selected item. Validate goal, scope, acceptance criteria, and alignment with the listed constraints. Review the committed implementation that moved the item into review; do not require an uncommitted worktree diff, because implement-item commits before review. If an acceptance criterion refers to a diff, evaluate the relevant committed change set and resulting file state for this item. If acceptable, write acceptance rationale to agent/tmp/review-item-accept.md using agent/templates/review-accept-template.md. Acceptance rationale must include at least one executed runtime/build check with command and observed result. Then execute agent/scripts/finalize-review-accept-item.sh ${ITEM} agent/tmp/review-item-accept.md. If not acceptable, write findings to agent/tmp/review-item-findings.md using the required structure from agent/templates/review-findings-template.md. Each failed criterion must include: Criterion, Status (pass|fail), Evidence, and Risk. Then execute agent/scripts/finalize-review-return-item.sh ${ITEM} agent/tmp/review-item-findings.md.
OUT
