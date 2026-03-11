# Item 0002 - Backend CI Quality Gate

## Goal

Add backend lint and test enforcement to CI for backend-relevant pull requests.

## Scope

- implement a backend CI job in `.github/workflows/ci-quality.yml`
- run Rust quality commands for formatting, linting, and tests using `backend/Cargo.toml`
- ensure the backend CI job runs only when backend-relevant paths change

## Acceptance Criteria

- backend CI job runs `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test`
- backend CI job is conditionally gated by backend path changes
- executable verification:
  `cargo fmt --manifest-path backend/Cargo.toml --check && cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings && cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-0001`

## Out of Scope

- renderer lint/test setup
- semantic-release configuration
