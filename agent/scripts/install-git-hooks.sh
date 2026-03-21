#!/usr/bin/env sh
set -eu

usage() {
  cat <<'EOF'
Usage: agent/scripts/install-git-hooks.sh [install|status]

Commands:
  install  Configure this repository to use the tracked .githooks directory.
  status   Print the currently configured hooks path for this repository.
EOF
}

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
command_name="${1:-install}"

case "$command_name" in
  install)
    git -C "$repo_root" config --local core.hooksPath .githooks
    echo "Configured core.hooksPath=.githooks for $repo_root"
    ;;
  status)
    current_hooks_path="$(git -C "$repo_root" config --local --get core.hooksPath || true)"
    if [ -n "$current_hooks_path" ]; then
      echo "$current_hooks_path"
    else
      echo ".git/hooks"
    fi
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
