#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: agent/scripts/finalize-review-accept-item.sh <review-item-path|item-id> <acceptance-file>" >&2
  exit 2
fi

ITEM_INPUT="$1"
ACCEPT_FILE="$2"
EXEC_DIR="agent/execution"

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    DIR="$(dirname "${ITEM_INPUT}")"
    case "${BASE}" in
      review-item-*.md|done-item-*.md)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^[a-z]*-item-\([0-9][0-9]\)\.md$/\1/p')"
        ;;
      *)
        echo "Expected a review/done item file or numeric item id, got: ${ITEM_INPUT}" >&2
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

if ! printf '%s\n' "${ITEM_ID}" | grep -Eq '^[0-9]{2}$'; then
  echo "Item id must use exactly two digits, got: ${ITEM_ID}" >&2
  exit 4
fi

REVIEW_ITEM="${DIR}/review-item-${ITEM_ID}.md"
DONE_ITEM="${DIR}/done-item-${ITEM_ID}.md"

if [ -f "${REVIEW_ITEM}" ] && [ -f "${DONE_ITEM}" ]; then
  echo "Conflicting item states found for id ${ITEM_ID}: ${REVIEW_ITEM} and ${DONE_ITEM}" >&2
  exit 8
fi

if [ ! -f "${ACCEPT_FILE}" ]; then
  echo "Acceptance file not found: ${ACCEPT_FILE}" >&2
  exit 5
fi

if [ ! -s "${ACCEPT_FILE}" ]; then
  echo "Acceptance file is empty: ${ACCEPT_FILE}" >&2
  exit 6
fi

for required in "- Criteria Met:" "- Evidence:" "- Runtime/Build Check:" "- Residual Risk:"; do
  if ! grep -q -- "${required}" "${ACCEPT_FILE}"; then
    echo "Acceptance file missing required marker '${required}': ${ACCEPT_FILE}" >&2
    exit 7
  fi
done

if [ -f "${REVIEW_ITEM}" ]; then
  printf "\n\n## Review Acceptance\n\n" >> "${REVIEW_ITEM}"
  cat "${ACCEPT_FILE}" >> "${REVIEW_ITEM}"
  mv "${REVIEW_ITEM}" "${DONE_ITEM}"
elif [ ! -f "${DONE_ITEM}" ]; then
  echo "Item file not found for id ${ITEM_ID}: expected ${REVIEW_ITEM} or ${DONE_ITEM}" >&2
  exit 3
fi

TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s review_outcome=accept item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "$(basename "${REVIEW_ITEM}")" "$(basename "${DONE_ITEM}")" >> agent/tmp/task-metrics.log

git add -A
if [ -n "${ITEM_ID}" ]; then
  git commit -m "docs: accept review item ${ITEM_ID}"
else
  git commit -m "docs: accept review item"
fi
git pull -r
git push

echo "ITEM_MOVED=${DONE_ITEM}"
