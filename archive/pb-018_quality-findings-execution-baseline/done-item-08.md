# Migrate Renderer Test and Coverage Tooling to Vitest

## Goal

Adopt Vitest as the single renderer unit-test and coverage runner for local and CI workflows.

## Scope

- add and configure Vitest in renderer tooling
- migrate renderer test and coverage scripts from Node test runner to Vitest commands
- remove Node test-runner specific flags from renderer quality scripts
- preserve current test intent and quality gates after migration

## Acceptance Criteria

- renderer unit tests execute through Vitest locally
- renderer coverage is produced through Vitest and existing quality expectations remain satisfied
- renderer scripts no longer rely on `node --test` or Node experimental test-coverage flags
- executable verification: `npm --prefix renderer run test:coverage`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `agent/strategy/tech-stack.md`
- `renderer/package.json`
- `renderer/scripts/run-tests.mjs`
- `renderer/scripts/run-coverage.mjs`

## Out of Scope

- frontend framework migration
- expanding end-to-end suite breadth


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
