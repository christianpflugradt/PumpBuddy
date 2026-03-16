# Consolidate DB Integration Coverage in Backend Integration Tests

## Goal

Ensure live PostgreSQL persistence behavior is asserted only in backend integration suites with risk-based scenario prioritization and no duplicate DB-backed coverage in unit/module tests.

## Scope

- move remaining DB-backed persistence scenarios into integration tests under `backend/tests/`
- eliminate duplicated DB-backed scenarios between unit/module and integration layers
- prioritize integration coverage for critical happy paths and selected high-value edge cases
- keep integration tests aligned with current persistence semantics

## Acceptance Criteria

- integration tests are the only layer asserting live PostgreSQL persistence behavior
- duplicated DB-backed scenarios across unit and integration layers are removed
- integration suite covers critical happy paths plus selected high-value edge conditions
- executable verification: `cargo test --manifest-path backend/Cargo.toml --test persistence_integration`

## References

- `agent/strategy/plan.md`
- `FINDINGS.quality.md`
- `backend/tests/persistence_integration.rs`
- `backend/src/persistence/tests.rs`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-06`

## Out of Scope

- broad E2E test rollout
- unrelated backend feature development


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
