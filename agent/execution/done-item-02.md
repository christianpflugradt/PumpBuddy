# Split Renderer Workflow Orchestration Module

## Goal

Extract workout workflow orchestration from the monolithic renderer controller into a dedicated module that owns start, save, resume, complete, and cancel transitions.

## Scope

- create a dedicated renderer workflow orchestration module with explicit interfaces
- move transition orchestration logic out of `workout-controller.ts` into the new module
- keep presentation rendering and event binding behavior unchanged
- update composition wiring so `workout-controller.ts` no longer acts as the end-to-end workflow surface

## Acceptance Criteria

- workflow transition logic exists in a dedicated module and is invoked through explicit interfaces
- `renderer/src/workout-controller.ts` no longer contains full workflow orchestration logic
- workout start, save, resume, complete, and cancel behavior remains functionally unchanged
- executable verification: `npm --prefix renderer test`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `renderer/src/workout-controller.ts`
- `renderer/src/workout-state.ts`
- `renderer/src/workout-render.ts`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `open-item-03.md`
- `open-item-04.md`

## Out of Scope

- API contract changes
- visual redesign of workout screens


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
