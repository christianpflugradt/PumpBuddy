# Split Renderer Interaction and Persistence Coordination

## Goal

Move workout UI event routing and API persistence coordination out of `workout-controller.ts` into dedicated modules with explicit boundaries.

## Scope

- extract DOM listener registration and event routing into a focused interaction module
- extract workout persistence coordination (API call sequencing and save/retry coordination) into a focused persistence module
- compose the extracted modules through explicit interfaces from the controller wiring layer
- preserve current user-visible workout interaction behavior

## Acceptance Criteria

- dedicated interaction and persistence modules exist and are wired through explicit interfaces
- `renderer/src/workout-controller.ts` no longer directly owns the full event matrix and persistence coordination logic
- workout interactions and save lifecycle behavior remain unchanged for start, save, resume, complete, and cancel flows
- executable verification: `npm --prefix renderer test`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `renderer/src/workout-controller.ts`
- `renderer/src/workout-render.ts`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-02`

## Out of Scope

- introducing new API endpoints
- changing product copy or localization behavior


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
