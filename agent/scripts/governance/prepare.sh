#!/usr/bin/env bash
# Explicit dependency preparation, never invoked by a Rule or Git hook.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/playwright"
export PIP_CACHE_DIR="$PWD/.cache/pip"
export npm_config_cache="$PWD/.cache/npm"
mode="${1:-check}"
case "$mode" in check | candidate | readiness | badges) ;; *) exit 2 ;; esac
if [ "$mode" = candidate ]; then
  generator="$(sed -n 's/^OPENAPI_GENERATOR_IMAGE ?= //p' Makefile)"
  docker pull "$generator"
  make refresh-api-clients
  exit 0
fi
expected_node="$(python3 -c 'import pathlib, tomllib; print(tomllib.loads(pathlib.Path("mise.toml").read_text())["tools"]["node"])')"
if [ "$(node --version)" != "v$expected_node" ]; then
  echo "Prepare Node $expected_node before installing dependencies." >&2
  exit 1
fi
npm ci --ignore-scripts
npm --prefix renderer ci --ignore-scripts
if [ "$mode" = readiness ]; then
  exit 0
fi
python3 -m venv .tools/validation-venv
.tools/validation-venv/bin/python3 -m pip install -r validation/core/requirements.txt
sh agent/scripts/governance/require-release-rust.sh
cargo fetch --locked --manifest-path backend/Cargo.toml
generator="$(sed -n 's/^OPENAPI_GENERATOR_IMAGE ?= //p' Makefile)"
docker pull "$generator"
docker pull postgres:18-alpine
make refresh-api-clients
if [ "${CI:-}" = true ]; then
  (cd renderer && ./node_modules/.bin/playwright install --with-deps chromium firefox webkit)
else
  (cd renderer && ./node_modules/.bin/playwright install chromium)
fi
