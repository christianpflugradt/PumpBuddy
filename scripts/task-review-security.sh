#!/usr/bin/env bash
set -euo pipefail

emit_optional_load() {
  local path="$1"
  [ -f "$path" ] && echo "LOAD=${path}"
}

emit_execution_loads() {
  find agent/execution -type f -name '*.md' 2>/dev/null | sort || true
}

cat <<'OUT'
TASK=review-security
LOAD=agent/strategy/security.md
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
OUT

emit_optional_load "docker-compose.yml"
emit_optional_load "docker-compose.yaml"
emit_optional_load "Dockerfile"
emit_optional_load "Caddyfile"

while IFS= read -r path; do
  [ -n "$path" ] && echo "LOAD=${path}"
done < <(emit_execution_loads)

cat <<'OUT'
INSTRUCTION=Review security posture for the current milestone state. Focus on trust boundaries, auth/access separation, secret handling, and high-risk exposure paths. Prioritize findings by risk and provide practical remediation suggestions.
OUT
