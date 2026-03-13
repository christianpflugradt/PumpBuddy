#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_backend_quality() {
  cargo fmt --manifest-path "$repo_root/backend/Cargo.toml" --check
  cargo clippy --manifest-path "$repo_root/backend/Cargo.toml" --all-targets --all-features -- -D warnings
  cargo test --manifest-path "$repo_root/backend/Cargo.toml" -- --skip health_endpoint_latency_smoke
  "$repo_root/agent/scripts/check-backend-coverage.sh"
  run_backend_performance_smoke
}

run_backend_performance_smoke() {
  cargo test --manifest-path "$repo_root/backend/Cargo.toml" health_endpoint_latency_smoke
}

run_renderer_quality() {
  (
    cd "$repo_root/renderer"
    npm run lint
    npm run test -- --run
    npm run coverage:check
  )
}

collect_changed_paths() {
  local scope="${1:-worktree}"

  case "$scope" in
    worktree)
      git -C "$repo_root" diff --name-only HEAD --
      ;;
    upstream)
      if git -C "$repo_root" rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
        git -C "$repo_root" diff --name-only '@{upstream}'..HEAD --
      else
        git -C "$repo_root" diff-tree --no-commit-id --name-only -r HEAD
      fi
      ;;
    *)
      echo "Unknown change scope: $scope" >&2
      exit 1
      ;;
  esac
}

should_run_backend_quality() {
  local paths="$1"

  printf '%s\n' "$paths" | grep -Eq '^(backend/|backend$)' 2>/dev/null
}

should_run_renderer_quality() {
  local paths="$1"

  printf '%s\n' "$paths" | grep -Eq '^(renderer/|renderer$|frontend/|frontend$)' 2>/dev/null
}

run_changed_quality() {
  local scope="${1:-worktree}"
  local changed_paths
  local ran_any="0"

  changed_paths="$(collect_changed_paths "$scope")"

  if [ -z "$changed_paths" ]; then
    echo "No changed files detected for quality scope: $scope"
    return 0
  fi

  if should_run_backend_quality "$changed_paths"; then
    run_backend_quality
    ran_any="1"
  fi

  if should_run_renderer_quality "$changed_paths"; then
    run_renderer_quality
    ran_any="1"
  fi

  if [ "$ran_any" = "0" ]; then
    echo "Skipping codebase quality checks: no backend or renderer changes detected."
  fi
}

usage() {
  cat <<'EOF'
Usage: agent/scripts/run-quality.sh [backend|renderer|performance|check|changed|changed-upstream]

Commands:
  backend           Run backend validation, tests, coverage, and performance smoke.
  renderer          Run renderer validation, tests, and coverage.
  performance       Run backend performance smoke checks only.
  check             Run backend and renderer quality checks in CI-aligned order.
  changed           Run only the quality checks affected by current worktree changes.
  changed-upstream  Run only the quality checks affected by commits not in upstream.
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
  performance)
    run_backend_performance_smoke
    ;;
  check)
    run_backend_quality
    run_renderer_quality
    ;;
  changed)
    run_changed_quality worktree
    ;;
  changed-upstream)
    run_changed_quality upstream
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
