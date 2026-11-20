#!/usr/bin/env sh
set -eu

version="$(rustc --version)"
version="${version#rustc }"
version="${version%% *}"
if ! printf '%s\n' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "A released Rust compiler is required; found $version. Prepare a released toolchain, not a nightly, beta or development build, before running checks." >&2
  exit 1
fi
