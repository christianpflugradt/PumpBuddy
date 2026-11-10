#!/usr/bin/env sh
set -eu
if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: agent/scripts/check/run-quality-gate.sh <review-item-path>" >&2
  exit 2
fi
source_commit="$(git log -n 1 --format=%H -- "$1")"
[ -n "$source_commit" ] || exit 1
export QUALITY_GATE_SOURCE_COMMIT="$source_commit"
echo "QUALITY_GATE_SOURCE_COMMIT=$source_commit"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if make check >"$log" 2>&1; then
  cat "$log"
else
  status=$?
  cat "$log" >&2
  if grep -Eqi 'cannot connect to the docker daemon|permission denied while trying to connect to the docker daemon socket|docker daemon is not running|is the docker daemon running|dial unix .*/docker\.sock: connect: permission denied|error during connect' "$log"; then
    echo "QUALITY_GATE_RESULT=blocked_docker_unavailable" >&2
    exit 86
  fi
  exit "$status"
fi
echo "QUALITY_GATE_RESULT=passed"
