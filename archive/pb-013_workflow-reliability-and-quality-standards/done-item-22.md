# Stabilize Backend Postgres Tests In CI

## Goal

Ensure backend tests that rely on Postgres have a reachable database in CI so quality checks pass reliably.

## Scope

- confirm `ci-quality.yml` provisions a Postgres service or testcontainers-compatible setup for backend tests
- update backend test configuration/timeouts so the pool waits for readiness instead of timing out
- document any required env vars (e.g., `DATABASE_URL`) used by CI for Postgres-backed tests

## Acceptance Criteria

- backend tests in `ci-quality.yml` pass without connection timeouts
- rerunning backend test suite in CI is stable and does not hang on Postgres readiness

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `backend/src/persistence/tests.rs`
- `backend/Cargo.toml`


## Review Acceptance

- Criteria Met: CI provisions Postgres and sets TEST_DATABASE_URL; backend tests use retrying connections and reset schema to avoid readiness timeouts; CI reruns should no longer hang on Postgres readiness.
- Evidence: Postgres service + TEST_DATABASE_URL set in .github/workflows/ci-quality.yml, retrying connection logic in backend/src/test_support.rs used by persistence/workout tests, and integration test reset logic in backend/tests/support/mod.rs.
- Runtime/Build Check: `cargo check --manifest-path backend/Cargo.toml` (passed).
- Residual Risk: None identified.
