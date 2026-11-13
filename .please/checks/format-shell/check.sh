#!/usr/bin/env sh
set -eu
# shellcheck disable=SC2046
set -- $(git ls-files '*.sh')
[ "$#" -gt 0 ] || exit 0
# shfmt also exits 1 for syntax errors, but only formatting differences appear on standard output.
errors="$(mktemp)"
trap 'rm -f "$errors"' 0
status=0
differences="$(shfmt -d "$@" 2>"$errors")" || status=$?
[ "$status" -ne 0 ] || exit 0
if [ -n "$differences" ]; then
  printf '%s\n' "$differences"
  echo "FAIL: shfmt would reformat these scripts; run mise run format" >&2
  exit 1
fi
cat "$errors" >&2
echo "ERROR: shfmt failed" >&2
exit 2
