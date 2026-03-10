#!/usr/bin/env sh
set -eu

EXEC_DIR="agent/execution"

if [ ! -d "${EXEC_DIR}" ]; then
  exit 0
fi

missing_file="$(mktemp)"
cleanup() {
  rm -f "${missing_file}"
}
trap cleanup EXIT INT TERM

find "${EXEC_DIR}" -type f \( -name 'open-item-*.md' -o -name 'review-item-*.md' \) | sort | while IFS= read -r item; do
  for heading in "## Goal" "## Scope" "## Acceptance Criteria" "## References"; do
    if ! grep -q "^${heading}\$" "${item}"; then
      echo "Item content invalid: ${item} missing required section '${heading}'." >&2
      echo "1" > "${missing_file}"
    fi
  done
done

if [ -s "${missing_file}" ]; then
  exit 43
fi
