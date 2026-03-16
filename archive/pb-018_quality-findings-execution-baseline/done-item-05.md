# Relocate Backend Route Tests to Feature Modules

## Goal

Move route-level tests out of the backend router composition module into feature-focused modules so tests follow handler ownership boundaries.

## Scope

- extract route-level tests from router/wiring module into feature handler test modules
- keep test intent and endpoint behavior assertions equivalent after relocation
- ensure router module retains only minimal composition-oriented test coverage where needed
- keep test naming and organization aligned with feature boundaries

## Acceptance Criteria

- route-level tests are no longer concentrated in the router composition module
- feature modules own their relevant endpoint behavior tests
- backend API tests remain passing with equivalent behavior coverage
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/api/handlers.rs`
- `backend/src/api/mod.rs`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-04`

## Out of Scope

- adding new endpoint behavior not already in scope
- broad backend test-strategy changes outside API route tests


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


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
