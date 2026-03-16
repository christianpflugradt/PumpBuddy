# Modularize Backend API Router and Handlers

## Goal

Separate backend API transport wiring from endpoint handler implementation so router composition stays thin and feature logic is moved into focused handler modules.

## Scope

- keep top-level API router assembly focused on route and middleware composition
- move endpoint handler implementations out of the concentrated router module into feature-focused modules
- preserve API contract behavior and middleware enforcement
- update module wiring so handler boundaries are explicit and discoverable

## Acceptance Criteria

- router composition module is primarily wiring, not bulk handler implementation
- workout and related endpoint handler logic is split into dedicated feature modules
- existing API behavior remains unchanged for covered routes
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/api/handlers.rs`
- `backend/src/api/mod.rs`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- introducing new API routes
- changing OpenAPI contract semantics


## Review Findings

### Criterion

Executable verification (`cargo test --manifest-path backend/Cargo.toml`)

- Status: fail
- Evidence: `cargo test` was executed and multiple tests failed due to the PostgreSQL test database being unavailable at localhost:5433. Key failure message: "PostgreSQL test database is unavailable at localhost:5433. Start it with: docker compose --profile test up -d postgres-test". Test run summary: 19 passed; 16 failed; many failures are panics caused by the missing test DB.
- Risk: Without a successful test run we cannot validate that cross-user update/complete paths behave with not-found semantics; merging in this state risks shipping unverified behavior and regressing data integrity/ownership guarantees.

### Criterion

Cross-user mutation attempts for update and complete paths return not-found behavior

- Status: fail
- Evidence: The persistence code contains `AND user_id = $N::uuid` predicates on write queries (see `backend/src/persistence/active_workouts.rs`), however acceptance requires executable verification via tests. Because `cargo test` could not complete successfully (test DB unavailable), we did not observe runtime proof that cross-user attempts return NotFound and do not modify state.
- Risk: Relying solely on static inspection misses runtime interaction (transactions, cascade deletes, etc.). If ownership predicates are incomplete or other code paths bypass them, cross-user writes could alter another user's workout state.

### Additional Notes

- To resolve: start the PostgreSQL test instance (per test_support instructions) and re-run `cargo test --manifest-path backend/Cargo.toml`. If tests pass, re-run review to accept; otherwise update persistence SQL and tests until acceptance criteria are met.
