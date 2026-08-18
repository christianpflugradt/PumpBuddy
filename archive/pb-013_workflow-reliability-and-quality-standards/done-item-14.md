# Database-backed backend tests can pass without exercising PostgreSQL

## Summary

The backend test suite can report success even when the PostgreSQL-backed paths were never exercised, because multiple tests return early when no database or usable Docker runtime is available.

## Evidence

- `backend/tests/support/mod.rs:25-60` returns `None` from `TestDatabase::provision()` when no external database is configured or Docker is unavailable, after printing a skip message.
- `backend/tests/api_integration.rs:73-78`, `127-132`, and `158-163` convert that `None` result into a bare `return`, so the tests still pass.
- `backend/tests/persistence_integration.rs` contains the same pattern across all nine integration tests.
- `backend/src/application/workouts.rs:67-77` and `113-209` use the same optional-pool pattern for application validation tests, including early returns when the schema is missing.
- `cargo test --manifest-path backend/Cargo.toml` passed in this review run, but that success depends on environment availability rather than the tests enforcing their own required runtime.

## Goal

Make backend database-dependent tests fail or be explicitly ignored when their required PostgreSQL runtime is unavailable, so green test results always mean the intended persistence paths were actually exercised.

## Scope

- replace silent early returns in backend database-dependent tests with one deterministic policy
- either provision the required PostgreSQL runtime as part of the test harness or make unavailable-environment cases fail loudly
- keep pure unit tests independent from Docker or database requirements

## Acceptance Criteria

- backend tests that require PostgreSQL no longer pass via bare early returns when the database runtime is unavailable
- `cargo test --manifest-path backend/Cargo.toml` produces a trustworthy result: either the database-backed tests run, or the run fails with an actionable message
- the database-backed test policy is applied consistently across `backend/src/application/workouts.rs`, `backend/src/persistence.rs`, and `backend/tests/*`

## References

- `backend/tests/support/mod.rs`
- `backend/tests/api_integration.rs`
- `backend/tests/persistence_integration.rs`
- `backend/src/application/workouts.rs`
- `backend/src/persistence.rs`
- `agent/strategy/test-strategy.md`


## Review Acceptance

- Criteria Met: Database-backed tests now fail loudly when PostgreSQL is unavailable; runtime policy is consistent across integration tests, application validation tests, and persistence tests.
- Evidence: `TestDatabase::require()` panics on missing/unusable Docker or unset database URL in backend/tests/support/mod.rs, integration tests call `require()` in backend/tests/api_integration.rs and backend/tests/persistence_integration.rs, and unit/persistence tests use `require_pool()` with `TEST_DATABASE_URL` enforcement in backend/src/application/workouts.rs and backend/src/persistence/tests.rs.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml --no-run` (passed: test binaries built).
- Residual Risk: None identified.
