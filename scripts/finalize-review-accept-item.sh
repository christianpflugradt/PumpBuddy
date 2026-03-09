#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/finalize-review-accept-item.sh <review-item-path> <acceptance-file>" >&2
  exit 2
fi

ITEM="$1"
ACCEPT_FILE="$2"

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

if [ ! -f "${ACCEPT_FILE}" ]; then
  echo "Acceptance file not found: ${ACCEPT_FILE}" >&2
  exit 5
fi

if [ ! -s "${ACCEPT_FILE}" ]; then
  echo "Acceptance file is empty: ${ACCEPT_FILE}" >&2
  exit 6
fi

for required in "- Criteria Met:" "- Evidence:" "- Residual Risk:"; do
  if ! grep -q -- "${required}" "${ACCEPT_FILE}"; then
    echo "Acceptance file missing required marker '${required}': ${ACCEPT_FILE}" >&2
    exit 7
  fi
done

printf "\n\n## Review Acceptance\n\n" >> "${ITEM}"
cat "${ACCEPT_FILE}" >> "${ITEM}"

TARGET="${DIR}/$(printf '%s' "${BASE}" | sed 's/^review-item-/done-item-/')"
mv "${ITEM}" "${TARGET}"

ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^review-item-\([0-9][0-9]*\)\.md$/\1/p')"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s review_outcome=accept item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "${BASE}" "$(basename "${TARGET}")" >> agent/tmp/task-metrics.log

echo "ITEM_MOVED=${TARGET}"
