#!/usr/bin/env sh
set -eu

LOG_FILE="agent/tmp/task-metrics.log"

if [ ! -f "${LOG_FILE}" ]; then
  echo "No metrics found at ${LOG_FILE}."
  exit 0
fi

echo "Metrics report source: ${LOG_FILE}"
echo

TOTAL_TASKS="$(grep -c ' task=' "${LOG_FILE}" || true)"
IMPLEMENT_TRANSITIONS="$(grep -c ' implement_transition ' "${LOG_FILE}" || true)"
ACCEPT_COUNT="$(grep -c ' review_outcome=accept ' "${LOG_FILE}" || true)"
RETURN_COUNT="$(grep -c ' review_outcome=return ' "${LOG_FILE}" || true)"

echo "Total task runs: ${TOTAL_TASKS}"
echo "Implement transitions: ${IMPLEMENT_TRANSITIONS}"
echo "Review accepts: ${ACCEPT_COUNT}"
echo "Review returns: ${RETURN_COUNT}"

if [ "${ACCEPT_COUNT}" -gt 0 ] || [ "${RETURN_COUNT}" -gt 0 ]; then
  total_reviews=$((ACCEPT_COUNT + RETURN_COUNT))
  return_rate="$(awk -v r="${RETURN_COUNT}" -v t="${total_reviews}" 'BEGIN { if (t == 0) print "0.00"; else printf "%.2f", (r / t) * 100 }')"
  echo "Review return rate (%): ${return_rate}"
fi

echo
echo "Average LOAD count by task:"
awk '
  / task=/ {
    task=""
    loads=""
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^task=/) {
        split($i, a, "=")
        task=a[2]
      } else if ($i ~ /^loads=/) {
        split($i, b, "=")
        loads=b[2]
      }
    }
    if (task != "" && loads != "") {
      sum[task] += loads
      cnt[task] += 1
    }
  }
  END {
    for (t in cnt) {
      printf "- %s: %.2f (%d runs)\n", t, sum[t] / cnt[t], cnt[t]
    }
  }
' "${LOG_FILE}" | sort

echo
echo "Items with most review returns:"
awk '
  / review_outcome=return / {
    id=""
    for (i = 1; i <= NF; i++) {
      if ($i ~ /^item_id=/) {
        split($i, a, "=")
        id=a[2]
      }
    }
    if (id != "") {
      cnt[id] += 1
    }
  }
  END {
    for (id in cnt) {
      printf "%s %d\n", id, cnt[id]
    }
  }
' "${LOG_FILE}" | sort -k2,2nr -k1,1 | head -n 10 | awk '{ printf "- item-%s: %s returns\n", $1, $2 }'
