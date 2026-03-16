# Enforce Backend Unit Test Isolation from Real DB

## Goal

Convert backend unit/module persistence tests to isolated logic tests with mocked or fake dependencies so unit tests do not depend on a live PostgreSQL database.

## Scope

- replace DB-backed unit/module persistence test setup with mock/fake dependency seams
- keep unit tests focused on logic, mapping, and branch behavior that does not require real DB integration
- remove DB bootstrap/schema setup from unit/module test paths
- preserve meaningful edge and error branch validation in the unit layer

## Acceptance Criteria

- backend unit/module tests run without real database dependencies
- unit tests validate isolated logic through mocked or fake dependencies
- DB-backed assertions are removed from unit/module persistence test files
- executable verification: `cargo test --manifest-path backend/Cargo.toml --lib`

## References

- `agent/strategy/plan.md`
- `FINDINGS.quality.md`
- `backend/src/persistence/tests.rs`
- `agent/strategy/test-strategy.md`

## Out of Scope

- adding new product behavior
- reducing required backend integration coverage


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
