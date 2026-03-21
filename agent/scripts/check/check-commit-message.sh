#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: agent/scripts/check/check-commit-message.sh <commit-message-file>" >&2
  exit 2
fi

MSG_FILE="$1"
POLICY_FILE="agent/strategy/commit-policy.yaml"

if [ ! -f "${MSG_FILE}" ]; then
  echo "Commit message file not found: ${MSG_FILE}" >&2
  exit 3
fi

if [ ! -s "${MSG_FILE}" ]; then
  echo "Commit message file is empty: ${MSG_FILE}" >&2
  exit 4
fi

if [ ! -f "${POLICY_FILE}" ]; then
  echo "Commit policy file not found: ${POLICY_FILE}" >&2
  exit 5
fi

python3 - "${MSG_FILE}" "${POLICY_FILE}" <<'PY'
import re
import sys
from pathlib import Path

import yaml

msg_path = Path(sys.argv[1])
policy_path = Path(sys.argv[2])

first_line = ""
for line in msg_path.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()
    if stripped:
        first_line = stripped
        break

if not first_line:
    raise SystemExit(f"Commit message has no non-empty first line: {msg_path}")

policy = yaml.safe_load(policy_path.read_text(encoding="utf-8")) or {}
cc = policy.get("conventional_commit", {}) or {}
validation = policy.get("validation", {}) or {}

allowed_types = cc.get("allowed_types", []) or []
scope = cc.get("scope", {}) or {}
allowed_scopes = scope.get("allowed_values", []) or []
subject_min_len = int(validation.get("subject_min_length", 3))
forbid_scope_equal_type = bool(scope.get("forbid_scope_equal_to_type", True))

types_alt = "|".join(re.escape(t) for t in allowed_types)
scopes_alt = "|".join(re.escape(s) for s in allowed_scopes)
pattern = re.compile(rf"^(?P<type>{types_alt})(\((?P<scope>{scopes_alt})\))?(?P<breaking>!)?: (?P<subject>.+)$")
m = pattern.match(first_line)
if not m:
    raise SystemExit(
        "Commit subject must match Conventional Commit policy: "
        f"<type>(<scope>)?: <subject>, allowed types={allowed_types}, allowed scopes={allowed_scopes}"
    )

commit_type = m.group("type")
commit_scope = m.group("scope")
subject = m.group("subject").strip()
if len(subject) < subject_min_len:
    raise SystemExit(f"Commit subject too short (min {subject_min_len} chars): '{subject}'")

if forbid_scope_equal_type and commit_scope and commit_scope == commit_type:
    raise SystemExit(f"Commit scope must not equal commit type: {commit_type}")

print(f"PASS commit message policy: {first_line}")
PY
