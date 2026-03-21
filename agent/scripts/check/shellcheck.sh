#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "${ROOT_DIR}"

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "WARN shellcheck not installed; skipping shell script lint."
  echo "INFO install with: brew install shellcheck"
  exit 0
fi

FILES="$(find agent/scripts .githooks -type f -name '*.sh' | sort)"
if [ -z "${FILES}" ]; then
  echo "PASS shellcheck: no shell scripts found"
  exit 0
fi

# shellcheck disable=SC2086
shellcheck ${FILES}
echo "PASS shellcheck: $(printf '%s\n' "${FILES}" | wc -l | tr -d ' ') files"
