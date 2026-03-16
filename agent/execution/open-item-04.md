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
- Evidence: Executed `cargo test --manifest-path backend/Cargo.toml` with the PostgreSQL test DB available. Test run failed: 2 failing tests in `tests/api_workouts.rs`.
  - `active_workout_routes_report_missing_state_and_conflicts` panicked asserting expected status `201` but got `400` when creating an active workout after a missing-state check.
  - `create_workout_maps_missing_foreign_keys_to_not_found` panicked asserting expected status `404` but got `400` when posting a workout with a missing variant foreign key.
  Command used: `cargo test --manifest-path backend/Cargo.toml` (see test output in CI/local run).
- Risk: Without a clean test run we cannot confirm the refactor preserved API semantics; merging risks shipping endpoints that return incorrect status codes and break clients.

### Criterion

Existing API behavior remains unchanged for covered routes

- Status: fail
- Evidence: Integration tests assert specific HTTP statuses and error messages for several workout routes. The refactored handlers/router now cause at least two behavior changes (400 vs expected 201/404) per the failing tests above.
- Risk: Behavioral regressions in status codes and error mappings can break downstream clients and indicate handler wiring or validation mapping regressions introduced during modularization.

### Additional Notes

- The PostgreSQL test instance was started locally (`docker compose --profile test up -d postgres-test`) and is reachable at localhost:5433 for the test run.
- To reproduce locally: `docker compose --profile test up -d postgres-test && cargo test --manifest-path backend/Cargo.toml --test api_workouts`.
