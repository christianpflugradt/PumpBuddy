#!/usr/bin/env sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

contract_path="agent/design/api-contract.yaml"
backend_toolchain_file="$repo_root/backend/rust-toolchain.toml"

resolve_backend_rust_toolchain() {
  if [ ! -f "$backend_toolchain_file" ]; then
    echo "ERROR backend toolchain file not found: $backend_toolchain_file" >&2
    exit 1
  fi

  channel="$(sed -n 's/^channel = "\(.*\)"/\1/p' "$backend_toolchain_file" | head -n 1)"
  if [ -z "$channel" ]; then
    echo "ERROR could not resolve Rust toolchain channel from $backend_toolchain_file" >&2
    exit 1
  fi

  printf '%s\n' "$channel"
}

cleanup_testcontainers() {
  container_ids="$(docker ps -aq --filter label=org.testcontainers.managed-by=testcontainers || true)"
  if [ -n "$container_ids" ]; then
    # Remove testcontainers-owned leftovers without touching compose-managed app containers.
    printf '%s\n' "$container_ids" | xargs docker rm -f >/dev/null 2>&1 || true
  fi
}

current_git_commit() {
  (
    cd "$repo_root"
    git rev-parse HEAD
  )
}

current_git_timestamp() {
  (
    cd "$repo_root"
    git show --no-patch --date=iso-strict --format=%cd HEAD
  )
}

api_contract_changed_locally() {
  (
    cd "$repo_root"
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      return 0
    fi

    if ! git diff --quiet -- "$contract_path"; then
      return 0
    fi
    if ! git diff --cached --quiet -- "$contract_path"; then
      return 0
    fi
    if git ls-files --others --exclude-standard -- "$contract_path" | grep -q .; then
      return 0
    fi

    return 1
  )
}

should_refresh_api_clients() {
  if [ "${CI:-}" = "true" ] || [ "${FORCE_REFRESH_API_CLIENTS:-0}" = "1" ]; then
    return 0
  fi

  api_contract_changed_locally
}

renderer_install_deps_if_needed() {
  lockfile="package-lock.json"
  marker_file="node_modules/.pumpbuddy-lockfile.cksum"

  if [ "${CI:-}" = "true" ]; then
    npm ci
    return 0
  fi

  if [ ! -d "node_modules" ]; then
    npm ci
  else
    current_cksum="$(cksum "$lockfile" | awk '{print $1 ":" $2}')"
    saved_cksum=""
    if [ -f "$marker_file" ]; then
      saved_cksum="$(cat "$marker_file")"
    fi

    if [ "$current_cksum" != "$saved_cksum" ]; then
      npm ci
    else
      echo "INFO renderer deps unchanged; skipping npm ci"
      return 0
    fi
  fi

  cksum "$lockfile" | awk '{print $1 ":" $2}' >"$marker_file"
}

run_backend_quality() {
  backend_toolchain="$(resolve_backend_rust_toolchain)"
  export RUSTUP_TOOLCHAIN="$backend_toolchain"
  echo "INFO backend quality uses Rust toolchain $backend_toolchain (source: backend/rust-toolchain.toml)"

  if should_refresh_api_clients; then
    make -C "$repo_root" refresh-backend-api-client
  else
    echo "INFO API contract unchanged; skipping backend API client refresh"
  fi
  TESTCONTAINERS_COMMAND=remove cargo fmt --manifest-path "$repo_root/backend/Cargo.toml" --check
  TESTCONTAINERS_COMMAND=remove cargo clippy --manifest-path "$repo_root/backend/Cargo.toml" --all-targets --all-features -- -D warnings
  if [ "${CI:-}" = "true" ] || [ "${BACKEND_CHECK_WITH_COVERAGE:-0}" = "1" ]; then
    "$repo_root/agent/scripts/check-backend-coverage.sh"
  else
    TESTCONTAINERS_COMMAND=remove cargo test --manifest-path "$repo_root/backend/Cargo.toml"
  fi
  cleanup_testcontainers
}

run_renderer_quality() {
  make -C "$repo_root" refresh-frontend-api-client
  (
    cd "$repo_root/renderer"
    # Ensure optional native deps (for example Rollup platform packages) are consistent.
    renderer_install_deps_if_needed
    if [ "${CI:-}" = "true" ]; then
      npx playwright install --with-deps chromium firefox webkit
    fi
    npm run check
  )
}

run_release_artifact_quality() {
  release_commit="$(current_git_commit)"
  release_timestamp="$(current_git_timestamp)"
  release_tag="${RELEASE_ARTIFACT_APP_VERSION:-quality-check}"
  backend_tag="${RELEASE_ARTIFACT_BACKEND_TAG:-pumpbuddy-backend:quality-check}"
  renderer_tag="${RELEASE_ARTIFACT_RENDERER_TAG:-pumpbuddy-renderer:quality-check}"

  make -C "$repo_root" refresh-backend-api-client
  make -C "$repo_root" refresh-frontend-api-client

  docker build \
    --file "$repo_root/backend/Dockerfile" \
    --tag "$backend_tag" \
    --build-arg "APP_VERSION=$release_tag" \
    --build-arg "BUILD_COMMIT=$release_commit" \
    --build-arg "BUILD_TIMESTAMP=$release_timestamp" \
    "$repo_root/backend"

  docker build \
    --file "$repo_root/renderer/Dockerfile" \
    --tag "$renderer_tag" \
    "$repo_root/renderer"
}

usage() {
  cat <<'EOF'
Usage: agent/scripts/run-quality.sh [backend|renderer|release-artifacts|check]

Commands:
  backend   Run backend quality checks.
  renderer  Run renderer quality checks.
  release-artifacts  Build shipped backend and renderer artifacts without publishing them.
  check     Run backend and renderer quality checks in order.
EOF
}

command_name="${1:-check}"

case "$command_name" in
  backend)
    run_backend_quality
    ;;
  renderer)
    run_renderer_quality
    ;;
  release-artifacts)
    run_release_artifact_quality
    ;;
  check)
    run_backend_quality
    run_renderer_quality
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
