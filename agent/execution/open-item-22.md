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
