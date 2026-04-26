#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

compose_file="runtime/compose/compose.prod.yaml"
runtime_readme="runtime/README.md"
root_readme="README.md"

if [ ! -f "$compose_file" ]; then
  echo "Missing required file: $compose_file" >&2
  exit 1
fi

if [ ! -f "$runtime_readme" ]; then
  echo "Missing required file: $runtime_readme" >&2
  exit 1
fi

if [ ! -f "$root_readme" ]; then
  echo "Missing required file: $root_readme" >&2
  exit 1
fi

if rg -n "printf 'Initial Access Key: %s" "$compose_file" >/dev/null 2>&1; then
  echo "FAIL $compose_file must not print plaintext bootstrap access keys to stdout." >&2
  rg -n "printf 'Initial Access Key: %s" "$compose_file" >&2
  exit 1
fi

if rg -n "logs init-access-key" "$runtime_readme" "$root_readme" >/dev/null 2>&1; then
  echo "FAIL Production docs must not instruct operators to read bootstrap keys from logs." >&2
  rg -n "logs init-access-key" "$runtime_readme" "$root_readme" >&2
  exit 1
fi

echo "OK bootstrap secret handoff guardrail passed"
