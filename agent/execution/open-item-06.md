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
