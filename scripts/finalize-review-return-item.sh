#!/usr/bin/env sh
set -eu

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

for required in "### Criterion" "- Status:" "- Evidence:" "- Risk:"; do
  if ! grep -q "${required}" "${FINDINGS_FILE}"; then
    echo "Findings file missing required marker '${required}': ${FINDINGS_FILE}" >&2
    exit 7
  fi
done

printf "\n\n## Review Findings\n\n" >> "${ITEM}"
cat "${FINDINGS_FILE}" >> "${ITEM}"

TARGET="${DIR}/$(printf '%s' "${BASE}" | sed 's/^review-item-/open-item-/')"
mv "${ITEM}" "${TARGET}"

ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^review-item-\([0-9][0-9]*\)\.md$/\1/p')"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s review_outcome=return item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "${BASE}" "$(basename "${TARGET}")" >> agent/tmp/task-metrics.log

echo "ITEM_MOVED=${TARGET}"
