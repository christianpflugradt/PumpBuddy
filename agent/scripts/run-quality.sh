#!/usr/bin/env sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

run_backend_quality() {
  cargo fmt --manifest-path "$repo_root/backend/Cargo.toml" --check
  cargo clippy --manifest-path "$repo_root/backend/Cargo.toml" --all-targets --all-features -- -D warnings
  "$repo_root/agent/scripts/check-backend-coverage.sh"
}

run_renderer_quality() {
  (
    cd "$repo_root/renderer"
    npm run lint
    npm run test
    npm run test:coverage
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
