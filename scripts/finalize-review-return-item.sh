#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: scripts/finalize-review-return-item.sh <review-item-path|item-id> <findings-file>" >&2
  exit 2
fi

ITEM_INPUT="$1"
FINDINGS_FILE="$2"
EXEC_DIR="agent/execution"

case "${ITEM_INPUT}" in
  *[!0-9]*)
    BASE="$(basename "${ITEM_INPUT}")"
    DIR="$(dirname "${ITEM_INPUT}")"
    case "${BASE}" in
      review-item-*.md|open-item-*.md)
        ITEM_ID="$(printf '%s' "${BASE}" | sed -n 's/^[a-z]*-item-\([0-9][0-9]*\)\.md$/\1/p')"
        ;;
      *)
        echo "Expected a review/open item file or numeric item id, got: ${ITEM_INPUT}" >&2
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

REVIEW_ITEM="${DIR}/review-item-${ITEM_ID}.md"
OPEN_ITEM="${DIR}/open-item-${ITEM_ID}.md"

if [ -f "${REVIEW_ITEM}" ] && [ -f "${OPEN_ITEM}" ]; then
  echo "Conflicting item states found for id ${ITEM_ID}: ${REVIEW_ITEM} and ${OPEN_ITEM}" >&2
  exit 8
fi

if [ ! -f "${FINDINGS_FILE}" ]; then
  echo "Findings file not found: ${FINDINGS_FILE}" >&2
  exit 5
fi

if [ ! -s "${FINDINGS_FILE}" ]; then
  echo "Findings file is empty: ${FINDINGS_FILE}" >&2
  exit 6
fi

for required in "### Criterion" "- Status:" "- Evidence:" "- Risk:"; do
  if ! grep -q -- "${required}" "${FINDINGS_FILE}"; then
    echo "Findings file missing required marker '${required}': ${FINDINGS_FILE}" >&2
    exit 7
  fi
done

if [ -f "${REVIEW_ITEM}" ]; then
  if grep -q '^## Review Findings$' "${REVIEW_ITEM}"; then
    trimmed_item="$(mktemp)"
    awk '
      /^## Review Findings$/ { exit }
      { print }
    ' "${REVIEW_ITEM}" > "${trimmed_item}"
    mv "${trimmed_item}" "${REVIEW_ITEM}"
  fi

  printf "\n\n## Review Findings\n\n" >> "${REVIEW_ITEM}"
  cat "${FINDINGS_FILE}" >> "${REVIEW_ITEM}"
  mv "${REVIEW_ITEM}" "${OPEN_ITEM}"
elif [ ! -f "${OPEN_ITEM}" ]; then
  echo "Item file not found for id ${ITEM_ID}: expected ${REVIEW_ITEM} or ${OPEN_ITEM}" >&2
  exit 3
fi

TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s review_outcome=return item_id=%s from=%s to=%s\n' "${TIMESTAMP}" "${ITEM_ID:-unknown}" "$(basename "${REVIEW_ITEM}")" "$(basename "${OPEN_ITEM}")" >> agent/tmp/task-metrics.log

git add -A
if [ -n "${ITEM_ID}" ]; then
  git commit -m "docs: return review item ${ITEM_ID} with findings"
else
  git commit -m "docs: return review item with findings"
fi
git push

echo "ITEM_MOVED=${OPEN_ITEM}"
