#!/usr/bin/env sh
set -eu
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root"

verify_toolchain() {
  sh agent/scripts/governance/require-stable-rust.sh
}

require_models() {
  if [ ! -d backend/target/generated/openapi/rust/src/models ] ||
    [ ! -f renderer/generated/openapi/typescript/runtime.ts ]; then
    echo "Generated API models missing; run make prepare before targeted checks." >&2
    exit 1
  fi
}

cleanup_testcontainers() {
  container_ids="$(docker ps -aq --filter label=org.testcontainers.managed-by=testcontainers || true)"
  if [ -n "$container_ids" ]; then
    printf '%s\n' "$container_ids" | xargs docker rm --force --volumes >/dev/null 2>&1 || true
  fi
}

case "${1:-check}" in
format-rust)
  verify_toolchain
  cargo fmt --manifest-path backend/Cargo.toml --check
  ;;
format-python)
  # Pass the files as arguments, not through xargs, so the formatter's exit status stays 1 (FAIL).
  # shellcheck disable=SC2046
  set -- $(git ls-files '*.py')
  [ "$#" -gt 0 ] || exit 0
  ruff format --check -- "$@"
  ;;
format-shell)
  # shellcheck disable=SC2046
  set -- $(git ls-files '*.sh')
  [ "$#" -gt 0 ] || exit 0
  shfmt -d "$@"
  ;;
backend)
  trap cleanup_testcontainers 0
  verify_toolchain
  require_models
  docker image inspect postgres:18-alpine >/dev/null
  TESTCONTAINERS_COMMAND=remove cargo clippy --offline --locked --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings
  if [ "${BACKEND_CHECK_WITH_COVERAGE:-0}" = "1" ]; then
    agent/scripts/check-backend-coverage.sh
  else
    TESTCONTAINERS_COMMAND=remove cargo test --offline --locked --manifest-path backend/Cargo.toml
  fi
  ;;
renderer)
  export PLAYWRIGHT_BROWSERS_PATH="$repo_root/.cache/playwright"
  require_models
  # Installed local tools only; npm/npx fallback paths cannot download packages.
  (cd renderer && npm_config_offline=true npm run check)
  ;;
release-artifacts)
  require_models
  source_commit="$(git rev-parse HEAD)"
  source_timestamp="$(git show --no-patch --date=iso-strict --format=%cd HEAD)"
  version="${RELEASE_TAG:-quality-check}"
  docker build --provenance=false --sbom=false --file backend/Dockerfile \
    --tag pumpbuddy-backend:candidate \
    --build-arg "APP_VERSION=$version" \
    --build-arg "BUILD_COMMIT=$source_commit" \
    --build-arg "BUILD_TIMESTAMP=$source_timestamp" backend
  docker build --provenance=false --sbom=false --file renderer/Dockerfile \
    --tag pumpbuddy-renderer:candidate \
    --build-arg "APP_VERSION=$version" --build-arg "BUILD_COMMIT=$source_commit" renderer
  ;;
check) exec make check ;;
*)
  echo "Usage: agent/scripts/run-quality.sh [format-rust|format-python|format-shell|backend|renderer|release-artifacts|check]" >&2
  exit 2
  ;;
esac
