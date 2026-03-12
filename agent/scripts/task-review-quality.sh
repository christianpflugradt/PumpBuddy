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

emit_optional_load() {
  path="$1"
  if [ -f "$path" ]; then
    echo "LOAD=$path"
  fi
  return 0
}

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' -o -name 'done-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-quality
OUT

require_file "agent/strategy/plan.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/templates/extended-review-findings-template.md"
emit_optional_load "agent/strategy/capabilities.md"

emit_item_loads | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

echo "WRITE=FINDINGS.md"

cat <<'OUT'
INSTRUCTION=Review active plan quality posture. Focus on test effectiveness, reliability/error handling, maintainability, and practical performance baseline confidence. Write the review artifact to FINDINGS.md in the repository root using agent/templates/extended-review-findings-template.md. Prioritize each finding from P0 to P3. After FINDINGS.md is drafted, return to the stakeholder, ask them to review the findings, and ask whether backlog items should be created from all findings, only one priority, or through a priority threshold such as through-p2. If the stakeholder approves backlog creation, run agent/scripts/create-review-backlog.sh FINDINGS.md <approved-mode>. When backlog items are created, remove FINDINGS.md before committing and pushing so the normal plan-item and implement-item flow can continue. Do not perform deep stack governance or security posture review in this task.
OUT
