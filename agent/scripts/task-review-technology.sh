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

cat <<'OUT'
TASK=review-technology
OUT

require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/templates/extended-review-findings-template.md"
emit_optional_load "Dockerfile"
emit_optional_load "docker-compose.yml"
emit_optional_load "docker-compose.yaml"
emit_optional_load "package.json"
emit_optional_load "Cargo.toml"
emit_optional_load ".github/workflows/ci.yml"
emit_optional_load ".github/workflows/release.yml"

echo "WRITE=FINDINGS.md"

require_file "agent/templates/task-output-template.md"
cat <<'OUT'
INSTRUCTION=Review technology adherence for the current implementation. Focus on stack compliance, dependency/tooling choices, and compatibility policy alignment. Write the review artifact to FINDINGS.md in the repository root using agent/templates/extended-review-findings-template.md. Prioritize each finding from P0 to P3. After FINDINGS.md is drafted, return to the stakeholder, ask them to review the findings, and ask whether backlog items should be created from all findings, only one priority, or through a priority threshold such as through-p2. If the stakeholder approves backlog creation, run agent/scripts/create-review-backlog.sh FINDINGS.md <approved-mode>. When backlog items are created, remove FINDINGS.md before committing and pushing so the normal plan-item and implement-item flow can continue. Do not perform broader architecture, quality, or security review except obvious violations. Use the output format from agent/templates/task-output-template.md exactly; respond with only `Status:`, `Task:`, `Workspace:` and optional `Context:` lines, omitting `Context:` when none applies. If `Status:` is not `SUCCESS`, include `Reason:` on up to 3 lines describing why.
OUT
