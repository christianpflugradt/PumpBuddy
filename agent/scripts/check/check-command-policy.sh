#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "${ROOT_DIR}"

TARGET_FILES="$(
  {
    find agent/execution/plans -maxdepth 1 -type f -name 'plan-item-*.yaml' 2>/dev/null
    find agent/execution/items -maxdepth 1 -type f \( -name 'open-item-*.yaml' -o -name 'review-item-*.yaml' \) 2>/dev/null
  } | sort
)"

if [ -z "${TARGET_FILES}" ]; then
  echo "PASS command policy check skipped (no active plan/open/review item files found)"
  exit 0
fi
TARGET_COUNT="$(printf '%s\n' "${TARGET_FILES}" | wc -l | tr -d ' ')"

FORBIDDEN_PATTERN='\b(npm|pnpm|yarn|bun|npx|vitest|jest|pytest)\b|\bcargo[[:space:]]+(test|clippy|fmt|nextest)\b'

MATCHES="$(printf '%s\n' "${TARGET_FILES}" | xargs rg -n -e "${FORBIDDEN_PATTERN}" || true)"

if [ -n "${MATCHES}" ]; then
  echo "FAIL command policy violation in active execution artifacts." >&2
  echo "FAIL Use Makefile quality/test commands only: make check, make check-renderer, make check-backend." >&2
  echo "FAIL Forbidden direct tool commands detected:" >&2
  printf '%s\n' "${MATCHES}" >&2
  exit 1
fi

echo "PASS command policy check ok (${TARGET_COUNT} files scanned)"
