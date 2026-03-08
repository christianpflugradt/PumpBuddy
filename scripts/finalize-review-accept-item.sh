#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/finalize-review-accept-item.sh <review-item-path>" >&2
  exit 2
fi

ITEM="$1"

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

TARGET="${DIR}/${BASE/review-item-/done-item-}"
mv "${ITEM}" "${TARGET}"

echo "ITEM_MOVED=${TARGET}"
