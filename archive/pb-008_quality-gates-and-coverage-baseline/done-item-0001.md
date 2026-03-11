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


## Review Acceptance

- Criteria Met: Backend CI now gates backend changes with `cargo fmt`, `cargo clippy`, `cargo test`, and `agent/scripts/check-backend-coverage.sh`; the coverage gate is implemented in executable project tooling with branch coverage enabled via `cargo llvm-cov --branch` and a minimum threshold of `65` defined in the script.
- Evidence: [`.github/workflows/ci-quality.yml`] wires the backend job behind backend path detection and runs formatting, clippy, tests, and the coverage script; [`agent/scripts/check-backend-coverage.sh`] generates a JSON summary with `cargo llvm-cov --branch`, reads branch totals from the report, and exits non-zero when the measured percentage is below `BACKEND_BRANCH_COVERAGE_MIN` or the default `65`.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml` passed locally with 18 tests passing; `agent/scripts/check-backend-coverage.sh` executed and reached the coverage test run, but in this sandbox the integration tests could not start PostgreSQL containers because Docker access was denied (`Operation not permitted`), so full local coverage verification could not complete here.
- Residual Risk: Coverage verification still depends on a Docker-capable environment for the existing integration tests; acceptance assumes the intended supported setup includes Docker access, as in CI.
