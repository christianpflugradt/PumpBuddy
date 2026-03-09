#!/usr/bin/env sh
set -eu

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

TARGET="${DIR}/$(printf '%s' "${BASE}" | sed 's/^open-item-/review-item-/')"

mv "${ITEM}" "${TARGET}"

ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^open-item-\([0-9][0-9]*\)\.md$/\1/p')"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s implement_transition item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "${BASE}" "$(basename "${TARGET}")" >> agent/tmp/task-metrics.log

git add -A
git commit -F "${MSG_FILE}"
git push

echo "ITEM_MOVED=${TARGET}"
