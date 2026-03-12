#!/bin/sh
set -eu

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

required_quality_artifacts() {
  cat <<'EOF'
badges/backend-coverage.json|agent/scripts/check-backend-coverage.sh
badges/backend-coverage.svg|agent/scripts/check-backend-coverage.sh
badges/renderer-coverage.json|(cd renderer && npm run coverage:check)
badges/renderer-coverage.svg|(cd renderer && npm run coverage:check)
EOF
}

hash_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return 0
  fi

  sha256sum "$1" | awk '{print $1}'
}

artifact_state() {
  artifact_path="$repo_root/$1"

  if [ ! -f "$artifact_path" ]; then
    printf 'missing\n'
    return 0
  fi

  hash_file "$artifact_path"
}

snapshot_artifacts() {
  snapshot_path="$1"

  : >"$snapshot_path"
  required_quality_artifacts | while IFS='|' read -r relative_path regenerate_command; do
    printf '%s|%s|%s\n' "$relative_path" "$(artifact_state "$relative_path")" "$regenerate_command" >>"$snapshot_path"
  done
}

verify_artifacts() {
  snapshot_path="$1"
  stale_artifacts=0

  while IFS='|' read -r relative_path previous_state regenerate_command; do
    current_state="$(artifact_state "$relative_path")"

    if [ "$previous_state" != "$current_state" ]; then
      printf 'Required quality artifact was stale: %s\n' "$relative_path" >&2
      printf 'Regenerate with: %s\n' "$regenerate_command" >&2
      stale_artifacts=1
    fi
  done <"$snapshot_path"

  if [ "$stale_artifacts" -ne 0 ]; then
    printf '%s\n' 'Quality artifacts changed during `run-quality.sh check`; regenerate them before rerunning the check.' >&2
    exit 1
  fi
}

usage() {
  cat <<'EOF'
Usage: agent/scripts/check-quality-artifacts.sh [snapshot|verify] <snapshot-path>
EOF
}

command_name="${1:-}"
snapshot_path="${2:-}"

case "$command_name" in
  snapshot)
    [ -n "$snapshot_path" ] || {
      usage >&2
      exit 1
    }
    snapshot_artifacts "$snapshot_path"
    ;;
  verify)
    [ -n "$snapshot_path" ] || {
      usage >&2
      exit 1
    }
    verify_artifacts "$snapshot_path"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
