# Restore backend quality automation

## Goal

Restore a reliable backend quality flow in CI with formatting, linting, tests, and branch coverage enforcement.

## Scope

- fix the backend portion of the CI quality workflow so it runs successfully for backend changes
- add backend branch coverage reporting and a pragmatic minimum threshold enforced in CI
- keep the backend quality commands aligned with the Rust toolchain and repository layout already in use

## Acceptance Criteria

- backend CI runs `cargo fmt`, `cargo clippy`, backend tests, and backend branch coverage for backend changes
- the backend coverage step fails when measured branch coverage drops below the agreed threshold defined in repository tooling
- `cargo fmt --manifest-path backend/Cargo.toml --check` succeeds in a clean checkout after the item is implemented
- `cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings` succeeds after the item is implemented
- an executable backend coverage verification command is documented in the CI or project tooling and succeeds locally in the supported setup

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/design/domain-model.md`

## Out of Scope

- adding new renderer quality tooling
- adding README coverage badges

## Notes for Review

- verify that the backend coverage metric is branch coverage, not line-only coverage
- verify that the threshold lives in executable project tooling rather than only in prose
