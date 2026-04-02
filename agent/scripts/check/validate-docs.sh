#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT_DIR"
export ROOT_DIR

COMMON_LIB="$ROOT_DIR/agent/scripts/lib/common.sh"
if [ -f "$COMMON_LIB" ]; then
  # shellcheck source=/dev/null
  . "$COMMON_LIB"
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
# Avoid creating __pycache__ artifacts during local quality checks.
export PYTHONDONTWRITEBYTECODE=1

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Error: Python interpreter '$PYTHON_BIN' not found." >&2
  exit 1
fi

if ! "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1
import importlib
importlib.import_module("pydantic")
importlib.import_module("yaml")
PY
then
  echo "Error: Missing Python dependencies. Install them with:" >&2
  echo "  $PYTHON_BIN -m pip install -r validation/core/requirements.txt" >&2
  exit 1
fi

"$PYTHON_BIN" -m validation.core.validate "$@"
agent/scripts/check/check-execution-items.sh
agent/scripts/check/shellcheck.sh
agent/scripts/check/check-workspace-cleanliness.sh
