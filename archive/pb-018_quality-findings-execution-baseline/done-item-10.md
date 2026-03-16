# Pin Semantic-Release Toolchain in Repository Dependencies

## Goal

Make release automation deterministic by defining semantic-release and required plugins as pinned repository-managed dependencies with lockfile control.

## Scope

- add a repository-managed Node toolchain definition for semantic-release and required plugins with explicit versions
- generate and commit lockfile metadata that governs release-tool resolution
- keep release semantics aligned with existing `.releaserc.json` behavior
- avoid floating `npx -p` package resolution in release execution

## Acceptance Criteria

- semantic-release and required plugins are defined in version-controlled dependency metadata with explicit versions
- lockfile coverage exists for release-time dependency resolution
- release behavior remains compatible with current `.releaserc.json` rules
- executable verification: `npm ci` and `npx semantic-release --dry-run`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`

## Out of Scope

- changing Conventional Commits policy
- redesigning release channel strategy


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
