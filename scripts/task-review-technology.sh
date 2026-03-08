#!/usr/bin/env bash
set -euo pipefail

emit_optional_load() {
  local path="$1"
  [ -f "$path" ] && echo "LOAD=${path}"
}

cat <<'OUT'
TASK=review-technology
LOAD=agent/strategy/tech-stack.md
LOAD=agent/strategy/engineering-guardrails.md
OUT

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
