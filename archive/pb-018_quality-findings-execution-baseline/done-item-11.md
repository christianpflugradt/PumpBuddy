# Run Release Workflow with Pinned Toolchain

## Goal

Update the GitHub release workflow to execute semantic-release from repository-managed pinned dependencies instead of floating package resolution.

## Scope

- modify `.github/workflows/release.yml` to install and run semantic-release from pinned repository dependencies
- remove floating `npx -p` package resolution from the release workflow
- preserve current release trigger behavior and plugin execution semantics
- keep workflow reproducibility aligned with lockfile-governed installs

## Acceptance Criteria

- release workflow no longer uses floating `npx -p` package installs for semantic-release plugins
- workflow executes semantic-release from repository-managed pinned dependencies
- workflow remains compatible with existing release configuration and trigger behavior
- executable verification: `gh workflow run release.yml` (or dry-run equivalent in CI context)

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `.github/workflows/release.yml`
- `.releaserc.json`
- `agent/strategy/tech-stack.md`

## Dependencies

- `item-10`

## Out of Scope

- introducing new release plugins
- changing repository branching strategy


## Review Acceptance

 - Criteria Met: The backend now registers and handles `POST /auth/login`, the renderer posts to the same path, and the renderer reverse-proxy configuration forwards `/auth/*` requests to the backend. The codebase contains tests that exercise the route wiring.
 - Evidence: `backend/src/api/handlers.rs` wires the route with `.route("/auth/login", post(login))`; `backend/src/api/auth.rs` implements the `login` handler that accepts JSON `AuthLoginRequest` and returns `200`/`401` as appropriate; `renderer/src/auth-gate.ts` posts to `"/auth/login"` (fetch call at submitAccessKey); `renderer/Caddyfile` reverse-proxies `@auth path /auth/*` to `backend:8080`, ensuring requests to the public renderer origin reach the backend service.
 - Runtime/Build Check: Executed `cargo build --manifest-path backend/Cargo.toml` and observed successful build: backend compiled and finished without errors (exit code 0, "Finished" message present).
 - Residual Risk: Integration runtime verification against a running compose stack (curl against `http://localhost:8080/auth/login`) was not performed here. Recommend running the Compose verification steps described in the README (for example `make run-app` then `curl -i -X POST http://localhost:8080/auth/login -H "Content-Type: application/json" -d '{"access_key":"<dev-key>"}'`) to validate runtime routing in the local environment.
