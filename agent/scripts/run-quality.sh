#!/usr/bin/env sh
set -eu
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo_root"

verify_toolchain() {
  expected="$(sed -n 's/^channel = "\(.*\)"/\1/p' backend/rust-toolchain.toml)"
  export RUSTUP_TOOLCHAIN="$expected"
  actual="$(rustc --version | awk '{print $2}')"
  docker_toolchain="$(sed -n 's/^ARG RUST_TOOLCHAIN=//p' backend/Dockerfile)"
  if [ "$actual" != "$expected" ] || [ "$docker_toolchain" != "$expected" ]; then
    echo "Rust compiler ($actual) and Docker ($docker_toolchain) must match rust-toolchain.toml ($expected)." >&2
    exit 1
  fi
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
  format)
    verify_toolchain
    cargo fmt --manifest-path backend/Cargo.toml --check
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
    if [ "${PLEASE_EXECUTION_POINT:-}" = "release-candidate" ]; then
      export DOCKER_DEFAULT_PLATFORM=linux/amd64
    fi
    expected="$(sed -n 's/^channel = "\(.*\)"/\1/p' backend/rust-toolchain.toml)"
    [ "$(sed -n 's/^ARG RUST_TOOLCHAIN=//p' backend/Dockerfile)" = "$expected" ]
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
  *) echo "Usage: agent/scripts/run-quality.sh [format|backend|renderer|release-artifacts|check]" >&2; exit 2 ;;
esac
