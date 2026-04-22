#!/usr/bin/env sh
set -eu

echo "next-item has no dedicated finalize step." >&2
echo "Run the delegated task finalize script from next-item output (FINALIZE_SCRIPT=...)." >&2
exit 2
