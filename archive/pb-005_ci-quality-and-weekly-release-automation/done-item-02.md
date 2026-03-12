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

- `item-01`

## Out of Scope

- renderer lint/test setup
- semantic-release configuration


## Review Findings

### Criterion

[Executable verification passes for the backend quality gate]

- Status: fail
- Evidence: Executed `cargo fmt --manifest-path backend/Cargo.toml --check && cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings && cargo test --manifest-path backend/Cargo.toml` from the repository root. The command failed at the formatting step with rustfmt diffs in committed backend files including `backend/src/persistence.rs`, `backend/src/main.rs`, and `backend/tests/persistence_integration.rs`.
- Risk: The new CI backend quality job is configured, but it will fail immediately on backend-relevant pull requests against the current repository state. That means the item does not yet deliver a usable enforced quality gate baseline.


## Review Acceptance

- Criteria Met: The backend CI job in `.github/workflows/ci-quality.yml` runs `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo test`, and it is gated by backend path changes via `detect-changes` and `dorny/paths-filter`.
- Evidence: The workflow defines `backend-quality` with the required Rust commands and `if: ${{ needs.detect-changes.outputs.backend == 'true' }}`. Backend path filters include `backend/**`, `Cargo.toml`, and `Cargo.lock`.
- Runtime/Build Check: Executed `cargo fmt --manifest-path backend/Cargo.toml --check && cargo clippy --manifest-path backend/Cargo.toml --all-targets --all-features -- -D warnings && cargo test --manifest-path backend/Cargo.toml` from the repository root; result: exit code 0, clippy completed without warnings, and tests passed (`7` tests total across unit and integration suites).
- Residual Risk: none identified
