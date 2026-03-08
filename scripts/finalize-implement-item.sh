#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/finalize-implement-item.sh <open-item-path>" >&2
  exit 2
fi

ITEM="$1"
MSG_FILE="agent/tmp/implement-item-commit-message.txt"

if [ ! -f "${ITEM}" ]; then
  echo "Item file not found: ${ITEM}" >&2
  exit 3
fi

BASE="$(basename "${ITEM}")"
DIR="$(dirname "${ITEM}")"

case "${BASE}" in
  open-item-*.md)
    ;;
  *)
    echo "Expected an open item file, got: ${ITEM}" >&2
    exit 4
    ;;
esac

if [ ! -f "${MSG_FILE}" ]; then
  echo "Commit message file not found: ${MSG_FILE}" >&2
  exit 5
fi

if [ ! -s "${MSG_FILE}" ]; then
  echo "Commit message file is empty: ${MSG_FILE}" >&2
  exit 6
fi

TARGET="${DIR}/${BASE/open-item-/review-item-}"

mv "${ITEM}" "${TARGET}"

git add -A
git commit -F "${MSG_FILE}"
git push

echo "ITEM_MOVED=${TARGET}"
