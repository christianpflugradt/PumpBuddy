#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

prod_compose_file="runtime/compose/compose.prod.yaml"
dev_compose_file="runtime/compose/compose.dev.yaml"
runtime_readme="runtime/README.md"
root_readme="README.md"

for required_file in "$prod_compose_file" "$dev_compose_file" "$runtime_readme" "$root_readme"; do
  if [ ! -f "$required_file" ]; then
    echo "Missing required file: $required_file" >&2
    exit 1
  fi
done

if rg -n "printf 'Initial Access Key: %s" "$prod_compose_file" >/dev/null 2>&1; then
  echo "FAIL $prod_compose_file must not print plaintext bootstrap access keys to stdout." >&2
  rg -n "printf 'Initial Access Key: %s" "$prod_compose_file" >&2
  exit 1
fi

if rg -n '^[[:space:]]*(printf|echo).*\$\$access_key' "$prod_compose_file" | rg -v '>[[:space:]]*"?\$\$handoff_path"?' >/dev/null 2>&1; then
  echo "FAIL $prod_compose_file must write bootstrap access keys only to the handoff file, not stdout." >&2
  rg -n '^[[:space:]]*(printf|echo).*\$\$access_key' "$prod_compose_file" | rg -v '>[[:space:]]*"?\$\$handoff_path"?' >&2
  exit 1
fi

non_loopback_dev_db_ports="$(rg -n '^[[:space:]]*-[[:space:]]*"?[^"]*:5432"?[[:space:]]*$' "$dev_compose_file" | rg -v '127\.0\.0\.1:' || true)"
if [ -n "$non_loopback_dev_db_ports" ]; then
  echo "FAIL $dev_compose_file must publish PostgreSQL ports only on 127.0.0.1." >&2
  printf '%s\n' "$non_loopback_dev_db_ports" >&2
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
