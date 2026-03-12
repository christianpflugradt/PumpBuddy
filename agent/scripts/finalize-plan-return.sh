#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/finalize-plan-return.sh <findings-file>" >&2
  exit 2
fi

FINDINGS_FILE="$1"
EXEC_DIR="agent/execution"

if [ ! -f "${FINDINGS_FILE}" ]; then
  echo "Findings file not found: ${FINDINGS_FILE}" >&2
  exit 3
fi

if [ ! -s "${FINDINGS_FILE}" ]; then
  echo "Findings file is empty: ${FINDINGS_FILE}" >&2
  exit 4
fi

DONE_COUNT="$(find "${EXEC_DIR}" -type f -name 'done-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"
OPEN_COUNT="$(find "${EXEC_DIR}" -type f -name 'open-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"
REVIEW_COUNT="$(find "${EXEC_DIR}" -type f -name 'review-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"

if [ "${DONE_COUNT}" -lt 1 ]; then
  echo "Finalize return blocked: at least one done item is required." >&2
  exit 5
fi

if [ "${OPEN_COUNT}" -ne 0 ] || [ "${REVIEW_COUNT}" -ne 0 ]; then
  echo "Finalize return blocked: open or review items already exist." >&2
  exit 6
fi

START_MARKERS="$(grep -c '^<!-- ITEM -->$' "${FINDINGS_FILE}" || true)"
END_MARKERS="$(grep -c '^<!-- END ITEM -->$' "${FINDINGS_FILE}" || true)"

if [ "${START_MARKERS}" -lt 1 ]; then
  echo "Findings file must contain at least one '<!-- ITEM -->' block: ${FINDINGS_FILE}" >&2
  exit 7
fi

if [ "${START_MARKERS}" -ne "${END_MARKERS}" ]; then
  echo "Findings file has mismatched item block markers: ${FINDINGS_FILE}" >&2
  exit 8
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT INT TERM

awk -v tmp_dir="${TMP_DIR}" '
  BEGIN {
    in_item = 0
    count = 0
    err = 0
  }
  /^<!-- ITEM -->$/ {
    if (in_item == 1) {
      err = 2
      exit err
    }
    count++
    path = sprintf("%s/item-%02d.md", tmp_dir, count)
    in_item = 1
    next
  }
  /^<!-- END ITEM -->$/ {
    if (in_item == 0) {
      err = 3
      exit err
    }
    close(path)
    in_item = 0
    path = ""
    next
  }
  {
    if (in_item == 1) {
      print >> path
      next
    }
    if ($0 !~ /^[[:space:]]*$/) {
      err = 4
      exit err
    }
  }
  END {
    if (err != 0) {
      exit err
    }
    if (in_item == 1) {
      exit 5
    }
    if (count == 0) {
      exit 6
    }
  }
' "${FINDINGS_FILE}" || {
  rc="$?"
  case "${rc}" in
    2) echo "Findings file contains a nested ITEM block: ${FINDINGS_FILE}" >&2 ;;
    3) echo "Findings file contains an END ITEM marker without a matching ITEM block: ${FINDINGS_FILE}" >&2 ;;
    4) echo "Findings file may only contain blank lines outside ITEM blocks: ${FINDINGS_FILE}" >&2 ;;
    5) echo "Findings file ended before closing an ITEM block: ${FINDINGS_FILE}" >&2 ;;
    6) echo "Findings file did not yield any item drafts: ${FINDINGS_FILE}" >&2 ;;
    *) echo "Failed to parse findings file: ${FINDINGS_FILE}" >&2 ;;
  esac
  exit 9
}

for item_file in "${TMP_DIR}"/item-*.md; do
  [ -f "${item_file}" ] || continue
  if [ ! -s "${item_file}" ]; then
    echo "Generated item draft is empty: ${item_file}" >&2
    exit 10
  fi
  for required in '^# ' '^## Goal$' '^## Scope$' '^## Acceptance Criteria$' '^## References$'; do
    if ! grep -Eq "${required}" "${item_file}"; then
      echo "Generated item draft is missing required structure (${required}): ${item_file}" >&2
      exit 11
    fi
  done
done

MAX_ITEM_ID="$(
  find "${EXEC_DIR}" -type f -name '*item-*.md' 2>/dev/null | \
    sed -n 's/^.*-item-\([0-9][0-9]\)\.md$/\1/p' | \
    sort | \
    tail -n 1
)"

if [ -z "${MAX_ITEM_ID}" ]; then
  NEXT_NUM=1
else
  MAX_ITEM_ID_BASE10="$(printf '%s' "${MAX_ITEM_ID}" | sed 's/^0*//')"
  if [ -z "${MAX_ITEM_ID_BASE10}" ]; then
    MAX_ITEM_ID_BASE10=0
  fi
  NEXT_NUM="$((MAX_ITEM_ID_BASE10 + 1))"
fi

CREATED_COUNT=0
for item_file in "${TMP_DIR}"/item-*.md; do
  [ -f "${item_file}" ] || continue
  if [ "${NEXT_NUM}" -gt 99 ]; then
    echo "Cannot create more execution items: next id would exceed 99." >&2
    exit 12
  fi
  ITEM_ID="$(printf '%02d' "${NEXT_NUM}")"
  TARGET_PATH="${EXEC_DIR}/open-item-${ITEM_ID}.md"
  cp "${item_file}" "${TARGET_PATH}"
  NEXT_NUM="$((NEXT_NUM + 1))"
  CREATED_COUNT="$((CREATED_COUNT + 1))"
done

if [ "${CREATED_COUNT}" -lt 1 ]; then
  echo "No new execution items were created from ${FINDINGS_FILE}." >&2
  exit 13
fi

TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s finalize_outcome=return created_open_items=%s findings_file=%s\n' "${TIMESTAMP}" "${CREATED_COUNT}" "${FINDINGS_FILE}" >> agent/tmp/task-metrics.log

git add "${EXEC_DIR}"
git commit -m "docs: reopen active plan with stakeholder findings"
git push

echo "FINALIZE_RETURNED=1"
echo "CREATED_OPEN_ITEMS=${CREATED_COUNT}"
