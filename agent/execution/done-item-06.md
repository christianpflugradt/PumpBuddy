# Fix Backend Formatting Failure

## Goal

Restore backend CI stability by resolving the formatting drift in `backend/src/main.rs`.

## Scope

- update `backend/src/main.rs` to match the repository Rust formatting expectations
- keep the change limited to formatting or strictly formatting-adjacent cleanup required for `rustfmt`

## Acceptance Criteria

- `cargo fmt --manifest-path backend/Cargo.toml --check` passes
- the backend quality workflow no longer fails because of formatting drift in `backend/src/main.rs`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `.github/workflows/ci-quality.yml`
- `backend/src/main.rs`

## Out of Scope

- unrelated backend behavior changes
- renderer workflow changes


## Review Acceptance

- Criteria Met: `cargo fmt --manifest-path backend/Cargo.toml --check` passes, and commit `73e549f50d8402886c2c5de5e9040cb0c0167a72` (`style(backend): format main.rs`) keeps the item scoped to formatting-only changes in `backend/src/main.rs`, which satisfies the backend CI formatting goal defined in the item and matches the backend quality workflow's rustfmt requirement.
- Evidence: `git show --stat --patch 73e549f -- backend/src/main.rs` shows only formatting changes in assertion wrapping and whitespace within `backend/src/main.rs`; no workflow or backend behavior logic changed. `.github/workflows/ci-quality.yml` continues to run `agent/scripts/run-quality.sh backend`, and the item's specific rustfmt gate now passes against the reviewed file state.
- Runtime/Build Check: Executed `cargo fmt --manifest-path backend/Cargo.toml --check` from the repository root; command exited successfully with no output, indicating `backend/src/main.rs` matches rustfmt expectations.
- Residual Risk: none identified
