#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/finalize-plan.sh <plan-id>" >&2
  exit 2
fi

PLAN_ID="$1"
PLAN_FILE="agent/strategy/plan.md"
PLAN_TEMPLATE="agent/templates/plan-template.md"
ARCHIVE_ROOT="Archive"
ARCHIVE_DIR="${ARCHIVE_ROOT}/${PLAN_ID}"
EXEC_DIR="agent/execution"

if [ -z "${PLAN_ID}" ]; then
  echo "Plan ID must not be empty." >&2
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

if [ ! -f "${PLAN_FILE}" ]; then
  echo "Plan file not found: ${PLAN_FILE}" >&2
  exit 4
fi

if [ ! -f "${PLAN_TEMPLATE}" ]; then
  echo "Plan template not found: ${PLAN_TEMPLATE}" >&2
  exit 5
fi

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

cp "${PLAN_TEMPLATE}" "${PLAN_FILE}"

echo "PLAN_ARCHIVED=${ARCHIVE_DIR}"
echo "NEW_PLAN_FILE=${PLAN_FILE}"
