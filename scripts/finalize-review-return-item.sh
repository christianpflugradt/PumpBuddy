#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/finalize-review-return-item.sh <review-item-path> <findings-file>" >&2
  exit 2
fi

ITEM="$1"
FINDINGS_FILE="$2"

if [ ! -f "${ITEM}" ]; then
  echo "Item file not found: ${ITEM}" >&2
  exit 3
fi

BASE="$(basename "${ITEM}")"
DIR="$(dirname "${ITEM}")"

case "${BASE}" in
  review-item-*.md)
    ;;
  *)
    echo "Expected a review item file, got: ${ITEM}" >&2
    exit 4
    ;;
esac

if [ ! -f "${FINDINGS_FILE}" ]; then
  echo "Findings file not found: ${FINDINGS_FILE}" >&2
  exit 5
fi

if [ ! -s "${FINDINGS_FILE}" ]; then
  echo "Findings file is empty: ${FINDINGS_FILE}" >&2
  exit 6
fi

printf "\n\n## Review Findings\n\n" >> "${ITEM}"
cat "${FINDINGS_FILE}" >> "${ITEM}"

TARGET="${DIR}/${BASE/review-item-/open-item-}"
mv "${ITEM}" "${TARGET}"

echo "ITEM_MOVED=${TARGET}"
