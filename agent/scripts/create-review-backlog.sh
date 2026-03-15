#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: agent/scripts/create-review-backlog.sh <findings-file> <all|only-p0|only-p1|only-p2|only-p3|through-p0|through-p1|through-p2|through-p3>" >&2
  exit 2
fi

FINDINGS_FILE="$1"
MODE_RAW="$2"
MODE="$(printf '%s' "${MODE_RAW}" | tr '[:upper:]' '[:lower:]')"
EXEC_DIR="agent/execution"

if [ ! -f "${FINDINGS_FILE}" ]; then
  echo "Findings file not found: ${FINDINGS_FILE}" >&2
  exit 3
fi

if [ ! -s "${FINDINGS_FILE}" ]; then
  echo "Findings file is empty: ${FINDINGS_FILE}" >&2
  exit 4
fi

case "${MODE}" in
  all)
    MODE_KIND="through"
    MODE_PRIORITY="P3"
    ;;
  only-p0|only-p1|only-p2|only-p3)
    MODE_KIND="only"
    MODE_PRIORITY="$(printf '%s' "${MODE}" | tr '[:lower:]' '[:upper:]' | sed 's/^ONLY-//')"
    ;;
  through-p0|through-p1|through-p2|through-p3)
    MODE_KIND="through"
    MODE_PRIORITY="$(printf '%s' "${MODE}" | tr '[:lower:]' '[:upper:]' | sed 's/^THROUGH-//')"
    ;;
  *)
    echo "Unsupported backlog mode: ${MODE_RAW}" >&2
    exit 5
    ;;
esac

priority_rank() {
  case "$1" in
    P0) printf '0\n' ;;
    P1) printf '1\n' ;;
    P2) printf '2\n' ;;
    P3) printf '3\n' ;;
    *)
      echo "Unsupported priority: $1" >&2
      exit 6
      ;;
  esac
}

START_MARKERS="$(grep -c '^<!-- FINDING -->$' "${FINDINGS_FILE}" || true)"
END_MARKERS="$(grep -c '^<!-- END FINDING -->$' "${FINDINGS_FILE}" || true)"

if [ "${START_MARKERS}" -lt 1 ]; then
  echo "Findings file must contain at least one '<!-- FINDING -->' block: ${FINDINGS_FILE}" >&2
  exit 7
fi

if [ "${START_MARKERS}" -ne "${END_MARKERS}" ]; then
  echo "Findings file has mismatched finding block markers: ${FINDINGS_FILE}" >&2
  exit 8
fi

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT INT TERM

awk -v tmp_dir="${TMP_DIR}" '
  BEGIN {
    in_block = 0
    count = 0
    err = 0
  }
  /^<!-- FINDING -->$/ {
    if (in_block == 1) {
      err = 2
      exit err
    }
    count++
    path = sprintf("%s/finding-%02d.md", tmp_dir, count)
    in_block = 1
    next
  }
  /^<!-- END FINDING -->$/ {
    if (in_block == 0) {
      err = 3
      exit err
    }
    close(path)
    in_block = 0
    path = ""
    next
  }
  {
    if (in_block == 1) {
      print >> path
      next
    }
  }
  END {
    if (err != 0) {
      exit err
    }
    if (in_block == 1) {
      exit 4
    }
    if (count == 0) {
      exit 5
    }
  }
' "${FINDINGS_FILE}" || {
  rc="$?"
  case "${rc}" in
    2) echo "Findings file contains a nested FINDING block: ${FINDINGS_FILE}" >&2 ;;
    3) echo "Findings file contains an END FINDING marker without a matching FINDING block: ${FINDINGS_FILE}" >&2 ;;
    4) echo "Findings file ended before closing a FINDING block: ${FINDINGS_FILE}" >&2 ;;
    5) echo "Findings file did not yield any finding drafts: ${FINDINGS_FILE}" >&2 ;;
    *) echo "Failed to parse findings file: ${FINDINGS_FILE}" >&2 ;;
  esac
  exit 9
}

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

TARGET_RANK="$(priority_rank "${MODE_PRIORITY}")"
SELECTED_COUNT=0
CREATED_COUNT=0

for finding_file in "${TMP_DIR}"/finding-*.md; do
  [ -f "${finding_file}" ] || continue

  PRIORITY_COUNT="$(grep -Ec '^Priority:[[:space:]]*P[0-3]$' "${finding_file}" || true)"
  if [ "${PRIORITY_COUNT}" -ne 1 ]; then
    echo "Each finding must include exactly one 'Priority: P0'..'Priority: P3' line: ${finding_file}" >&2
    exit 10
  fi

  FINDING_PRIORITY="$(sed -n 's/^Priority:[[:space:]]*\(P[0-3]\)$/\1/p' "${finding_file}")"
  FINDING_RANK="$(priority_rank "${FINDING_PRIORITY}")"

  INCLUDE=0
  case "${MODE_KIND}" in
    only)
      [ "${FINDING_PRIORITY}" = "${MODE_PRIORITY}" ] && INCLUDE=1
      ;;
    through)
      if [ "${FINDING_RANK}" -le "${TARGET_RANK}" ]; then
        INCLUDE=1
      fi
      ;;
  esac

  if [ "${INCLUDE}" -ne 1 ]; then
    continue
  fi

  SELECTED_COUNT="$((SELECTED_COUNT + 1))"

  ITEM_DRAFT="${TMP_DIR}/item-$(printf '%02d' "${SELECTED_COUNT}").md"
  awk '
    /^Priority:[[:space:]]*P[0-3]$/ {
      next
    }
    {
      print
    }
  ' "${finding_file}" > "${ITEM_DRAFT}"

  if [ ! -s "${ITEM_DRAFT}" ]; then
    echo "Generated backlog draft is empty: ${finding_file}" >&2
    exit 11
  fi

  for required in '^# ' '^## Goal$' '^## Scope$' '^## Acceptance Criteria$' '^## References$'; do
    if ! grep -Eq "${required}" "${ITEM_DRAFT}"; then
      echo "Selected finding is missing required execution-item structure (${required}): ${finding_file}" >&2
      exit 12
    fi
  done

  if [ "${NEXT_NUM}" -gt 99 ]; then
    echo "Cannot create more execution items: next id would exceed 99." >&2
    exit 13
  fi

  ITEM_ID="$(printf '%02d' "${NEXT_NUM}")"
  TARGET_PATH="${EXEC_DIR}/open-item-${ITEM_ID}.md"
  cp "${ITEM_DRAFT}" "${TARGET_PATH}"
  NEXT_NUM="$((NEXT_NUM + 1))"
  CREATED_COUNT="$((CREATED_COUNT + 1))"
done

if [ "${CREATED_COUNT}" -eq 0 ]; then
  echo "CREATED_OPEN_ITEMS=0"
  echo "SELECTED_MODE=${MODE}"
  exit 0
fi

rm -f "${FINDINGS_FILE}"

TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
mkdir -p agent/tmp
printf '%s review_backlog_created=%s findings_file=%s mode=%s\n' "${TIMESTAMP}" "${CREATED_COUNT}" "${FINDINGS_FILE}" "${MODE}" >> agent/tmp/task-metrics.log

git add "${EXEC_DIR}"
if git ls-files --error-unmatch "${FINDINGS_FILE}" >/dev/null 2>&1; then
  git add -A "${FINDINGS_FILE}"
fi
git commit -m "docs: create review backlog items from findings"
git pull -r
git push

echo "CREATED_OPEN_ITEMS=${CREATED_COUNT}"
echo "SELECTED_MODE=${MODE}"
