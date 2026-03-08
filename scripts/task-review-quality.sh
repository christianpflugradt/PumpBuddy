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

emit_item_loads() {
  find agent/execution -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' \) | sort || true
}

cat <<'OUT'
TASK=review-quality
OUT

require_file "agent/strategy/test-strategy.md"
require_file "agent/strategy/engineering-guardrails.md"
require_file "agent/strategy/capabilities.md"

emit_item_loads | while IFS= read -r path; do
  [ -n "$path" ] && require_file "$path"
done

cat <<'OUT'
INSTRUCTION=Review active milestone quality posture. Focus on test effectiveness, reliability/error handling, maintainability, and practical performance baseline confidence. Do not perform deep stack governance or security posture review in this task.
OUT
