#!/usr/bin/env sh
set -eu
root="$(git rev-parse --show-toplevel)"
cd "$root"
case "${1:-install}" in
  install)
    expected="$(cat .please-version)"
    actual="v$(please --version | awk '{print $2}')"
    if [ "$actual" != "$expected" ]; then
      echo "Expected published Please Behave $expected; found $actual" >&2
      exit 1
    fi
    current="$(git config --local --get core.hooksPath || true)"
    case "$current" in
      .githooks|"$root/.githooks")
        for event in pre-commit commit-msg pre-push; do
          if [ -e ".githooks/$event" ] || [ -L ".githooks/$event" ]; then
            echo "Custom hook preserved: .githooks/$event; integrate it before setup." >&2
            exit 1
          fi
        done
        git config --local --unset core.hooksPath
        ;;
    esac
    exec please sync --yes
    ;;
  status)
    git config --local --get core.hooksPath || echo ".git/hooks"
    ;;
  *) echo "Usage: agent/scripts/install-git-hooks.sh [install|status]" >&2; exit 2 ;;
esac
