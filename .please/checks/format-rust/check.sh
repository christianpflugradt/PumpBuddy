#!/usr/bin/env sh
set -eu
sh tools/governance/require-release-rust.sh
cargo fmt --manifest-path backend/Cargo.toml --check
