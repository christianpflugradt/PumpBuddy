# Enforce Active Workout Write Ownership

## Goal

Ensure active-workout update and completion mutations are ownership-constrained in SQL so foreign `workout_id` values cannot be used for cross-user writes.

## Scope

- apply `workout_id + user_id` ownership predicates to active-workout write queries in the backend mutation flow
- ensure child-row mutation steps execute only after an ownership-constrained parent write succeeds
- preserve current same-user update and completion behavior
- add backend tests for cross-user update and complete mutation attempts with not-found semantics

## Acceptance Criteria

- active-workout write SQL in the mutation flow uses explicit `workout_id` and `user_id` predicates
- cross-user mutation attempts for update and complete paths return not-found behavior without modifying workout state
- same-user update and complete paths still succeed with existing expected behavior
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/persistence/active_workouts.rs`
- `backend/src/api/handlers.rs`
- `agent/strategy/security.md`

## Out of Scope

- introducing new public endpoints or changing API contract shapes
- broader authentication model redesign


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


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
