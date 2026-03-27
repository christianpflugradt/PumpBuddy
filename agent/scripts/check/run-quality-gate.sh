#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/check/run-quality-gate.sh <review-item-path>" >&2
  exit 2
fi

REVIEW_ITEM_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
QUALITY_GATES_CONFIG="agent/strategy/quality-gates.yaml"

cd "${ROOT_DIR}"

if [ ! -f "${REVIEW_ITEM_PATH}" ]; then
  echo "Review item not found: ${REVIEW_ITEM_PATH}" >&2
  exit 3
fi

if [ ! -f "${QUALITY_GATES_CONFIG}" ]; then
  echo "Quality gates config not found: ${QUALITY_GATES_CONFIG}" >&2
  exit 4
fi

SOURCE_COMMIT="$(git log -n 1 --format=%H -- "${REVIEW_ITEM_PATH}" || true)"
if [ -z "${SOURCE_COMMIT}" ]; then
  echo "Cannot determine source commit for review item: ${REVIEW_ITEM_PATH}" >&2
  exit 5
fi

CHANGED_FILES="$(git show --name-only --pretty=format: "${SOURCE_COMMIT}" | sed '/^$/d' || true)"
if [ -z "${CHANGED_FILES}" ]; then
  echo "QUALITY_GATE_SOURCE_COMMIT=${SOURCE_COMMIT}"
  echo "QUALITY_GATE_RESULT=skipped_no_changed_files"
  exit 0
fi

TMP_CHANGED="$(mktemp)"
trap 'rm -f "${TMP_CHANGED}"' EXIT
printf '%s\n' "${CHANGED_FILES}" > "${TMP_CHANGED}"
export QUALITY_GATE_SOURCE_COMMIT="${SOURCE_COMMIT}"

DECISIONS="$(
python3 - "${QUALITY_GATES_CONFIG}" "${TMP_CHANGED}" <<'PY'
import fnmatch
import sys
from pathlib import Path

import yaml

cfg_path = Path(sys.argv[1])
changed_path = Path(sys.argv[2])

cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8")) or {}
rules = cfg.get("rules", []) or []
changed = [line.strip() for line in changed_path.read_text(encoding="utf-8").splitlines() if line.strip()]

matched_rules = []
commands = []
seen_cmd = set()

for rule in rules:
    if not isinstance(rule, dict):
        continue
    rid = str(rule.get("id", "")).strip()
    patterns = [str(p).strip() for p in (rule.get("path_any") or []) if str(p).strip()]
    run = [str(c).strip() for c in (rule.get("commands") or []) if str(c).strip()]
    if not rid or not patterns or not run:
        continue
    if any(any(fnmatch.fnmatch(path, pattern) for pattern in patterns) for path in changed):
        matched_rules.append(rid)
        for cmd in run:
            if cmd not in seen_cmd:
                seen_cmd.add(cmd)
                commands.append(cmd)

for rid in matched_rules:
    print(f"RULE\t{rid}")
for cmd in commands:
    print(f"RUN\t{cmd}")
PY
)"

echo "QUALITY_GATE_SOURCE_COMMIT=${SOURCE_COMMIT}"

if [ -z "${DECISIONS}" ]; then
  echo "QUALITY_GATE_RESULT=skipped_no_matching_rules"
  exit 0
fi

printf '%s\n' "${DECISIONS}" | while IFS="$(printf '\t')" read -r kind value; do
  case "${kind}" in
    RULE)
      echo "QUALITY_GATE_MATCHED_RULE=${value}"
      ;;
    RUN)
      echo "QUALITY_GATE_RUN=${value}"
      tmp_log="$(mktemp)"
      if sh -lc "${value}" >"${tmp_log}" 2>&1; then
        cat "${tmp_log}"
        rm -f "${tmp_log}"
      else
        status=$?
        cat "${tmp_log}" >&2
        if grep -Eqi "cannot connect to the docker daemon|permission denied while trying to connect to the docker daemon socket|docker daemon is not running|is the docker daemon running|dial unix .*/docker\\.sock: connect: permission denied|error during connect" "${tmp_log}"; then
          rm -f "${tmp_log}"
          echo "QUALITY_GATE_RESULT=blocked_docker_unavailable" >&2
          exit 86
        fi
        rm -f "${tmp_log}"
        exit "${status}"
      fi
      ;;
  esac
done

echo "QUALITY_GATE_RESULT=passed"
