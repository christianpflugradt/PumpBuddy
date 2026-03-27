#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
COMMON_LIB="${ROOT_DIR}/agent/scripts/lib/common.sh"

# shellcheck source=/dev/null
. "${COMMON_LIB}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

cd "${TMP_DIR}"
git init -q

CLEAN_STATE="$(workspace_cleanliness)"
if [ "${CLEAN_STATE}" != "CLEAN" ]; then
  echo "FAIL workspace_cleanliness expected CLEAN in fresh repo, got: ${CLEAN_STATE}" >&2
  exit 1
fi

touch dirty.txt
DIRTY_STATE="$(workspace_cleanliness)"
if [ "${DIRTY_STATE}" != "DIRTY" ]; then
  echo "FAIL workspace_cleanliness expected DIRTY with untracked file, got: ${DIRTY_STATE}" >&2
  exit 1
fi

echo "PASS workspace_cleanliness"
