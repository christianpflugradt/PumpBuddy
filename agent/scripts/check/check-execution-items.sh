#!/usr/bin/env sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "${ROOT_DIR}"
export ROOT_DIR

COMMON_LIB="${ROOT_DIR}/agent/scripts/lib/common.sh"
if [ -f "${COMMON_LIB}" ]; then
  # shellcheck source=/dev/null
  . "${COMMON_LIB}"
fi

python3 - <<'PY'
import re
from pathlib import Path

try:
    import yaml
except Exception as exc:
    print(f"ERROR missing PyYAML: {exc}")
    raise SystemExit(1)

try:
    from validation.models.template_item_template import BacklogItemTemplateDoc
except Exception as exc:
    print(f"ERROR missing validation model import: {exc}")
    raise SystemExit(1)

exec_dir = Path("agent/execution/items")
execution_config = Path("agent/execution/execution-config.yaml")
legacy_dir = Path("agent/execution")
legacy_files = sorted(
    [
        p
        for p in legacy_dir.glob("*item-*.yaml")
        if p.is_file() and p.parent == legacy_dir
    ]
)
if legacy_files:
    print("FAIL legacy execution item files detected in agent/execution root:")
    for p in legacy_files:
        print(f"FAIL move to agent/execution/items: {p.as_posix()}")
    raise SystemExit(1)

if not exec_dir.exists():
    print("PASS no execution items directory")
    raise SystemExit(0)

item_width = 2
if execution_config.exists():
    try:
        cfg = yaml.safe_load(execution_config.read_text(encoding="utf-8")) or {}
        candidate = (((cfg.get("id_format") or {}).get("item_numeric_length")))
        if isinstance(candidate, int) and candidate > 0:
            item_width = candidate
    except Exception:
        pass

pattern = re.compile(rf"^(open|review|done)-item-(\d{{{item_width}}})\.yaml$")
files = sorted([p for p in exec_dir.iterdir() if p.is_file() and "item-" in p.name and p.suffix == ".yaml"])

errors = []
seen_numeric = {}
for p in files:
    m = pattern.match(p.name)
    if not m:
        sample = "0" * item_width
        errors.append(
            f"invalid filename pattern: {p.as_posix()} (expected <status>-item-{sample}.yaml)"
        )
        continue

    status, numeric = m.group(1), m.group(2)
    key = numeric
    seen_numeric.setdefault(key, set()).add(status)

    try:
        data = yaml.safe_load(p.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid yaml in {p.as_posix()}: {exc}")
        continue

    try:
        doc = BacklogItemTemplateDoc.model_validate(data)
    except Exception as exc:
        errors.append(f"schema validation failed for {p.as_posix()}: {exc}")
        continue

    if doc.item.status_hint != status:
        errors.append(
            f"status mismatch in {p.as_posix()}: filename status '{status}' != item.status_hint '{doc.item.status_hint}'"
        )

for numeric, statuses in sorted(seen_numeric.items()):
    if len(statuses) > 1:
        errors.append(f"conflicting item states for item id {numeric}: {sorted(statuses)}")

if errors:
    for e in errors:
        print(f"FAIL {e}")
    raise SystemExit(1)

print(f"PASS execution items valid ({len(files)} files)")
PY
