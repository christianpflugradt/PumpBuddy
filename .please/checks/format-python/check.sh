#!/usr/bin/env sh
set -eu
# Pass the files as arguments, not through xargs, so the formatter's exit status stays 1 (FAIL).
# shellcheck disable=SC2046
set -- $(git ls-files '*.py')
[ "$#" -gt 0 ] || exit 0
ruff format --check -- "$@"
