#!/usr/bin/env sh
set -eu

EXEC_DIR="agent/execution"

if [ ! -d "${EXEC_DIR}" ]; then
  exit 0
fi

tmp_names="$(mktemp)"
tmp_states="$(mktemp)"
cleanup() {
  rm -f "${tmp_names}" "${tmp_states}"
}
trap cleanup EXIT INT TERM

find "${EXEC_DIR}" -type f -name '*item-*.md' | sort | while IFS= read -r path; do
  base="$(basename "${path}")"
  printf '%s\n' "${base}" >> "${tmp_names}"
done

if [ ! -s "${tmp_names}" ]; then
  exit 0
fi

invalid_names="$(grep -Ev '^(open|review|done|plan)-item-[0-9]+\.md$' "${tmp_names}" || true)"
if [ -n "${invalid_names}" ]; then
  echo "Execution state invalid: unsupported item filename(s):" >&2
  printf '%s\n' "${invalid_names}" >&2
  exit 41
fi

grep -E '^(open|review|done)-item-[0-9]+\.md$' "${tmp_names}" | \
  sed -E 's/^(open|review|done)-item-([0-9]+)\.md$/\2 \1/' > "${tmp_states}"

if [ -s "${tmp_states}" ]; then
  duplicates="$(awk '
    {
      id=$1
      state=$2
      key=id ":" state
      state_count[key]++
      id_states[id] = id_states[id] " " state
    }
    END {
      for (k in state_count) {
        if (state_count[k] > 1) {
          split(k, parts, ":")
          printf "duplicate-state id=%s state=%s count=%d\n", parts[1], parts[2], state_count[k]
          bad=1
        }
      }
      for (id in id_states) {
        split(id_states[id], arr, " ")
        unique=0
        delete seen
        for (i in arr) {
          if (arr[i] == "") {
            continue
          }
          if (!(arr[i] in seen)) {
            seen[arr[i]]=1
            unique++
          }
        }
        if (unique > 1) {
          printf "multi-state id=%s states=%s\n", id, id_states[id]
          bad=1
        }
      }
      if (bad == 1) {
        exit 1
      }
    }
  ' "${tmp_states}" || true)"

  if [ -n "${duplicates}" ]; then
    echo "Execution state invalid: conflicting state assignments detected:" >&2
    printf '%s\n' "${duplicates}" >&2
    exit 42
  fi
fi
