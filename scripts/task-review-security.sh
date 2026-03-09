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
  [ -f "$path" ] && echo "LOAD=$path"
}

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-security
OUT

require_file "agent/strategy/security-baseline.md"
require_file "agent/strategy/security.md"
require_file "agent/strategy/tech-stack.md"
require_file "agent/strategy/engineering-guardrails.md"
emit_optional_load "docker-compose.yml"
emit_optional_load "docker-compose.yaml"
emit_optional_load "Dockerfile"
emit_optional_load "Caddyfile"

emit_item_loads | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

cat <<'OUT'
INSTRUCTION=Review active plan security posture. Focus on trust boundaries, auth/access separation, secret handling, and high-risk exposure paths. Prioritize findings by risk and provide practical remediation suggestions.
OUT
