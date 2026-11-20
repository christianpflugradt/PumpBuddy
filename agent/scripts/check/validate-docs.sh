#!/bin/sh
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"
export ROOT_DIR

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
  echo "  uv sync --locked" >&2
  exit 1
fi

"$PYTHON_BIN" -m validation.core.validate "$@"
