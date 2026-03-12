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

emit_api_contract_loads() {
  find agent/design -maxdepth 1 -type f -name 'api-contract*.yaml' | sort 2>/dev/null || true
}

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' -o -name 'done-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-consistency
OUT

require_file "agent/strategy/plan.md"
emit_optional_load "agent/strategy/capabilities.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/test-strategy.md"
require_file "agent/design/use-cases.md"
require_file "agent/design/domain-model.md"
require_file "agent/templates/extended-review-findings-template.md"
emit_api_contract_loads | while IFS= read -r path; do
  if [ -n "$path" ]; then
    emit_optional_load "$path"
  fi
done

emit_item_loads | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

echo "WRITE=FINDINGS.md"

cat <<'OUT'
INSTRUCTION=Review consistency across active plan intent, execution items, and implementation state. Focus only on cross-artifact alignment and drift detection. Write the review artifact to FINDINGS.md in the repository root using agent/templates/extended-review-findings-template.md. Prioritize each finding from P0 to P3. After FINDINGS.md is drafted, return to the stakeholder, ask them to review the findings, and ask whether backlog items should be created from all findings, only one priority, or through a priority threshold such as through-p2. If the stakeholder approves backlog creation, run agent/scripts/create-review-backlog.sh FINDINGS.md <approved-mode>. When backlog items are created, remove FINDINGS.md before committing and pushing so the normal plan-item and implement-item flow can continue. Do not perform deep architecture, technology, quality, or security evaluation in this task.
OUT
