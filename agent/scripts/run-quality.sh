#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_backend_quality() {
  cargo fmt --manifest-path "$repo_root/backend/Cargo.toml" --check
  cargo clippy --manifest-path "$repo_root/backend/Cargo.toml" --all-targets --all-features -- -D warnings
  cargo test --manifest-path "$repo_root/backend/Cargo.toml"
  "$repo_root/agent/scripts/check-backend-coverage.sh"
}

run_renderer_quality() {
  (
    cd "$repo_root/renderer"
    npm run lint
    npm run test -- --run
    npm run coverage:check
  )
}

usage() {
  cat <<'EOF'
Usage: agent/scripts/run-quality.sh [backend|renderer|check]

Commands:
  backend   Run backend validation, tests, and coverage.
  renderer  Run renderer validation, tests, and coverage.
  check     Run backend and renderer quality checks in CI-aligned order.
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
