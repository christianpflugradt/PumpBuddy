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
emit_optional_load "Dockerfile"
emit_optional_load "docker-compose.yml"
emit_optional_load "docker-compose.yaml"
emit_optional_load "package.json"
emit_optional_load "Cargo.toml"
emit_optional_load ".github/workflows/ci.yml"
emit_optional_load ".github/workflows/release.yml"

cat <<'OUT'
INSTRUCTION=Review technology adherence for the current implementation. Focus on stack compliance, dependency/tooling choices, and compatibility policy alignment. Do not perform broader architecture, quality, or security review except obvious violations.
OUT
