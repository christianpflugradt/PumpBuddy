#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/finalize-implement-item.sh <open-item-path|item-id>" >&2
  exit 2
fi

ITEM_INPUT="$1"
MSG_FILE="agent/tmp/implement-item-commit-message.txt"
EXEC_DIR="agent/execution"

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    DIR="$(dirname "${ITEM_INPUT}")"
    case "${BASE}" in
      open-item-*.md|review-item-*.md)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^[a-z]*-item-\([0-9][0-9]*\)\.md$/\1/p')"
        ;;
      *)
        echo "Expected an open/review item file or numeric item id, got: ${ITEM_INPUT}" >&2
        exit 4
        ;;
    esac
    ;;
  *)
    ITEM_ID="${ITEM_INPUT}"
    DIR="${EXEC_DIR}"
    ;;
esac

if [ -z "${ITEM_ID}" ]; then
  echo "Could not determine item id from input: ${ITEM_INPUT}" >&2
  exit 4
fi

OPEN_ITEM="${DIR}/open-item-${ITEM_ID}.md"
REVIEW_ITEM="${DIR}/review-item-${ITEM_ID}.md"

if [ -f "${OPEN_ITEM}" ] && [ -f "${REVIEW_ITEM}" ]; then
  echo "Conflicting item states found for id ${ITEM_ID}: ${OPEN_ITEM} and ${REVIEW_ITEM}" >&2
  exit 7
fi

if [ ! -f "${MSG_FILE}" ]; then
  echo "Commit message file not found: ${MSG_FILE}" >&2
  exit 5
fi

if [ ! -s "${MSG_FILE}" ]; then
  echo "Commit message file is empty: ${MSG_FILE}" >&2
  exit 6
fi

TARGET="${REVIEW_ITEM}"

if [ -f "${OPEN_ITEM}" ]; then
  mv "${OPEN_ITEM}" "${TARGET}"
  TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  mkdir -p agent/tmp
  printf '%s implement_transition item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "$(basename "${OPEN_ITEM}")" "$(basename "${TARGET}")" >> agent/tmp/task-metrics.log
elif [ ! -f "${TARGET}" ]; then
  echo "Item file not found for id ${ITEM_ID}: expected ${OPEN_ITEM} or ${TARGET}" >&2
  exit 3
fi

git add -A
git commit -F "${MSG_FILE}"
git push

echo "ITEM_MOVED=${TARGET}"
