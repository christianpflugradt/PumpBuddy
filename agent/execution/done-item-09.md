# Align CI and Docs with Renderer Vitest Baseline

## Goal

Update CI workflows and contributor documentation so renderer test and coverage execution consistently uses Vitest as the canonical baseline.

## Scope

- update CI job commands to use renderer Vitest test and coverage scripts
- remove any remaining CI references to Node built-in test-runner invocation for renderer unit tests
- update contributor-facing testing documentation to reference Vitest commands
- keep CI quality gates and expected workflow behavior unchanged

## Acceptance Criteria

- CI workflow definitions run renderer unit-test and coverage checks via Vitest commands
- contributor documentation references Vitest as the canonical renderer test flow
- no renderer unit-test CI path relies on Node test-runner specific flags
- executable verification: `npm --prefix renderer run test` and `npm --prefix renderer run test:coverage`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `agent/strategy/tech-stack.md`
- `renderer/package.json`
- `.github/workflows`

## Dependencies

- `item-08`

## Out of Scope

- non-renderer CI redesign
- release workflow changes


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
