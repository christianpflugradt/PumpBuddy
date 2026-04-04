#!/usr/bin/env sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

cleanup_testcontainers() {
  container_ids="$(docker ps -aq --filter label=org.testcontainers.managed-by=testcontainers || true)"
  if [ -n "$container_ids" ]; then
    # Remove testcontainers-owned leftovers without touching compose-managed app containers.
    printf '%s\n' "$container_ids" | xargs docker rm -f >/dev/null 2>&1 || true
  fi
}

run_backend_quality() {
  make -C "$repo_root" generate-openapi-backend
  TESTCONTAINERS_COMMAND=remove cargo fmt --manifest-path "$repo_root/backend/Cargo.toml" --check
  TESTCONTAINERS_COMMAND=remove cargo clippy --manifest-path "$repo_root/backend/Cargo.toml" --all-targets --all-features -- -D warnings
  "$repo_root/agent/scripts/check-backend-coverage.sh"
  cleanup_testcontainers
}

run_renderer_quality() {
  make -C "$repo_root" generate-openapi-renderer
  (
    cd "$repo_root/renderer"
    # Ensure optional native deps (for example Rollup platform packages) are consistent.
    npm ci
    if [ "${CI:-}" = "true" ]; then
      npx playwright install --with-deps chromium firefox webkit
    fi
    npm run check
  )
}

usage() {
  cat <<'EOF'
Usage: agent/scripts/run-quality.sh [backend|renderer|check]

Commands:
  backend   Run backend quality checks.
  renderer  Run renderer quality checks.
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
