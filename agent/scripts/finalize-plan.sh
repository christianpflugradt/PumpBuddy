#!/usr/bin/env sh
set -eu

if [ "$#" -ne 0 ]; then
  echo "Usage: agent/scripts/finalize-plan.sh" >&2
  exit 2
fi

PLAN_FILE="agent/strategy/plan.md"
PLAN_TEMPLATE="agent/templates/plan-template.md"
ARCHIVE_ROOT="archive"
EXEC_DIR="agent/execution"
RELEASE_WORKFLOW_FILE=".github/workflows/release.yml"

if [ ! -f "${PLAN_FILE}" ]; then
  echo "Plan file not found: ${PLAN_FILE}" >&2
  exit 4
fi

if [ ! -f "${PLAN_TEMPLATE}" ]; then
  echo "Plan template not found: ${PLAN_TEMPLATE}" >&2
  exit 5
fi

PLAN_ID="$(awk '
  /^## Plan ID$/ { in_id=1; next }
  in_id == 1 && NF > 0 { print; exit }
' "${PLAN_FILE}")"

if [ -z "${PLAN_ID}" ]; then
  echo "Plan ID not found in ${PLAN_FILE}. Add a non-empty value under '## Plan ID'." >&2
  exit 3
fi

case "${PLAN_ID}" in
  *[!A-Za-z0-9._-]*)
    echo "Plan ID contains invalid characters: ${PLAN_ID}" >&2
    exit 9
    ;;
  *..*)
    echo "Plan ID must not contain '..': ${PLAN_ID}" >&2
    exit 10
    ;;
esac

case "${PLAN_ID}" in
  pb-[0-9]*)
    PLAN_NUM="${PLAN_ID#pb-}"
    ;;
  *)
    echo "Plan ID must match 'pb-<digits>': ${PLAN_ID}" >&2
    exit 13
    ;;
esac

case "${PLAN_NUM}" in
  ''|*[!0-9]*)
    echo "Plan ID numeric suffix must contain only digits: ${PLAN_ID}" >&2
    exit 14
    ;;
esac

PLAN_NUM_WIDTH="${#PLAN_NUM}"
PLAN_NUM_BASE10="$(printf '%s' "${PLAN_NUM}" | sed 's/^0*//')"
if [ -z "${PLAN_NUM_BASE10}" ]; then
  PLAN_NUM_BASE10=0
fi
NEXT_PLAN_NUM="$((PLAN_NUM_BASE10 + 1))"
NEXT_PLAN_ID="$(printf "pb-%0${PLAN_NUM_WIDTH}d" "${NEXT_PLAN_NUM}")"

PLAN_NAME="$(sed -n 's/^# Plan:[[:space:]]*//p' "${PLAN_FILE}" | head -n 1)"
if [ -z "${PLAN_NAME}" ]; then
  echo "Plan title not found in ${PLAN_FILE}. Expected '# Plan: <Name>'." >&2
  exit 11
fi

PLAN_ID_SLUG="$(printf '%s' "${PLAN_ID}" | tr '[:upper:]' '[:lower:]')"
PLAN_SLUG="$(printf '%s' "${PLAN_NAME}" | tr ' ' '-' | tr -cd 'A-Za-z0-9._-' | tr '[:upper:]' '[:lower:]')"
if [ -z "${PLAN_SLUG}" ]; then
  echo "Plan name slug is empty after sanitization: ${PLAN_NAME}" >&2
  exit 12
fi

ARCHIVE_DIR="${ARCHIVE_ROOT}/${PLAN_ID_SLUG}_${PLAN_SLUG}"

DONE_COUNT="$(find "${EXEC_DIR}" -type f -name 'done-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"
OPEN_COUNT="$(find "${EXEC_DIR}" -type f -name 'open-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"
REVIEW_COUNT="$(find "${EXEC_DIR}" -type f -name 'review-item-*.md' 2>/dev/null | wc -l | tr -d ' ')"

if [ "${DONE_COUNT}" -lt 1 ]; then
  echo "Finalize blocked: at least one done item is required." >&2
  exit 6
fi

if [ "${OPEN_COUNT}" -ne 0 ] || [ "${REVIEW_COUNT}" -ne 0 ]; then
  echo "Finalize blocked: open or review items still exist." >&2
  exit 7
fi

if [ -e "${ARCHIVE_DIR}" ]; then
  echo "Archive target already exists: ${ARCHIVE_DIR}" >&2
  exit 8
fi

mkdir -p "${ARCHIVE_DIR}"
mv "${PLAN_FILE}" "${ARCHIVE_DIR}/plan.md"

find "${EXEC_DIR}" -type f -name '*item-*.md' 2>/dev/null | sort | while IFS= read -r path; do
  [ -n "${path}" ] && mv "${path}" "${ARCHIVE_DIR}/$(basename "${path}")"
done

TMP_PLAN_FILE="$(mktemp "${PLAN_FILE}.tmp.XXXXXX")"
awk -v next_id="${NEXT_PLAN_ID}" '
  BEGIN { in_id = 0; wrote_id = 0 }
  {
    if ($0 == "## Plan ID") {
      print
      in_id = 1
      next
    }
    if (in_id == 1 && wrote_id == 0 && NF == 0) {
      print
      next
    }
    if (in_id == 1 && wrote_id == 0) {
      print next_id
      wrote_id = 1
      in_id = 0
      next
    }
    print
  }
  END {
    if (wrote_id == 0) {
      exit 1
    }
  }
' "${PLAN_TEMPLATE}" > "${TMP_PLAN_FILE}" || {
  rm -f "${TMP_PLAN_FILE}"
  echo "Failed to render next plan file from template: ${PLAN_TEMPLATE}" >&2
  exit 15
}
mv "${TMP_PLAN_FILE}" "${PLAN_FILE}"

git add -A
git commit -m "docs: finalize ${PLAN_ID} plan archive"
git pull -r
git push

if ! command -v gh >/dev/null 2>&1; then
  echo "Release trigger failed: GitHub CLI 'gh' is not installed or not in PATH." >&2
  exit 16
fi

if ! gh workflow run "${RELEASE_WORKFLOW_FILE}"; then
  echo "Release trigger failed: could not dispatch workflow ${RELEASE_WORKFLOW_FILE}." >&2
  exit 17
fi

echo "PLAN_ARCHIVED=${ARCHIVE_DIR}"
echo "NEW_PLAN_FILE=${PLAN_FILE}"
echo "NEXT_PLAN_ID=${NEXT_PLAN_ID}"
