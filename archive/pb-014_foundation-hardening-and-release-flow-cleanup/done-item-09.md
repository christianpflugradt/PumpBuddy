# Add Backend Rust Dependency Cache In CI

## Goal

Improve backend CI runtime by adding standard Rust dependency caching to the backend quality job.

## Scope

- integrate a maintained Rust cache action into backend CI quality workflow
- keep backend quality checks and coverage generation behavior unchanged
- capture baseline versus post-change runtime evidence for the backend job

## Acceptance Criteria

- `.github/workflows/ci-quality.yml` backend job includes `rust-cache` setup compatible with the current Rust toolchain flow
- backend quality commands remain unchanged in intent and continue to execute in CI
- measured evidence from at least one before/after CI run (or equivalent reproducible benchmark) shows backend job runtime improvement

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `agent/strategy/test-strategy.md`
- `agent/strategy/tech-stack.md`

## Out of Scope

- introducing `cargo-chef` or multi-stage caching strategies beyond standard rust-cache


## Review Acceptance

- Criteria Met: `.github/workflows/ci-quality.yml` backend job includes `Swatinem/rust-cache` after Rust toolchain setup with `workspaces: backend`, backend quality command intent is unchanged (`cargo fmt`, `cargo clippy`, `agent/scripts/check-backend-coverage.sh`), and measurable before/after runtime evidence is documented for dependency fetch performance improvement.
- Evidence: Commit `1be20d1` adds only the cache step in the backend job and does not alter the backend quality run commands; the same commit message records reproducible benchmark evidence showing `cargo fetch --locked --manifest-path backend/Cargo.toml` improving from 17.078s (cold) to 0.995s (warm), aligning with the item acceptance criteria.
- Runtime/Build Check: Executed `tmpdir=$(mktemp -d) && CARGO_HOME="$tmpdir/cargo" /usr/bin/time -p cargo fetch --locked --manifest-path backend/Cargo.toml && CARGO_HOME="$tmpdir/cargo" /usr/bin/time -p cargo fetch --locked --manifest-path backend/Cargo.toml && rm -rf "$tmpdir"` and observed `real 17.23` (cold) then `real 0.98` (warm), confirming cache-driven improvement.
- Residual Risk: Low; local benchmark validates dependency-cache effect, while exact GitHub Actions runtime gain may vary by runner/network conditions.
