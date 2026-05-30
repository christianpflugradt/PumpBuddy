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

if rg -n '^[[:space:]]*(printf|echo).*\$\$access_key' "$compose_file" | rg -v '>[[:space:]]*"?\$\$handoff_path"?' >/dev/null 2>&1; then
  echo "FAIL $compose_file must write bootstrap access keys only to the handoff file, not stdout." >&2
  rg -n '^[[:space:]]*(printf|echo).*\$\$access_key' "$compose_file" | rg -v '>[[:space:]]*"?\$\$handoff_path"?' >&2
  exit 1
fi

if rg -n -i "(logs[[:space:]]+init-access-key|init-access-key.*logs|access key.*logs|logs.*access key|read.*key.*from.*logs)" "$runtime_readme" "$root_readme" >/dev/null 2>&1; then
  echo "FAIL Production docs must not instruct operators to read bootstrap keys from logs." >&2
  rg -n -i "(logs[[:space:]]+init-access-key|init-access-key.*logs|access key.*logs|logs.*access key|read.*key.*from.*logs)" "$runtime_readme" "$root_readme" >&2
  exit 1
fi

if rg -n "POSTGRES_PASSWORD=[^[:space:]]+" "$runtime_readme" "$root_readme" >/dev/null 2>&1; then
  echo "FAIL Production docs must use env-file secret injection instead of inline POSTGRES_PASSWORD assignments." >&2
  rg -n "POSTGRES_PASSWORD=[^[:space:]]+" "$runtime_readme" "$root_readme" >&2
  exit 1
fi

echo "OK bootstrap secret handoff guardrail passed"
