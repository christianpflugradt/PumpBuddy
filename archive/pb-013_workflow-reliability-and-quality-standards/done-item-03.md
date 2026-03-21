# Restore Compose Reset Workflow

## Goal

Fix the repository Docker workflow so `make compose-reset` works again in the intended local setup.

## Scope

- diagnose the current failure in the Compose or Dockerfile setup
- update repository-owned Docker or Compose configuration so the local reset workflow succeeds without informal manual workarounds
- keep the runtime topology aligned with the public renderer and private backend/database boundaries

## Acceptance Criteria

- `make compose-reset` succeeds from the repository root in the intended local Docker workflow
- the fix is implemented in repository configuration or scripts rather than relying on undocumented developer-only cleanup steps
- the resulting Compose setup still preserves the renderer as the only public entrypoint and keeps backend and database services private on the internal network

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `Makefile`
- `compose.yaml`
- `backend/Dockerfile`
- `renderer/Dockerfile`

## Out of Scope

- broader local-developer experience improvements unrelated to the broken reset workflow
- production deployment changes


## Review Acceptance

- Criteria Met: The renderer image build is now deterministic through `renderer/Dockerfile` using `package-lock.json` plus `npm ci`, `renderer/.dockerignore` excludes host `node_modules` and `dist` from the Docker build context, and the existing `compose.yaml` exposure model still keeps only `renderer` public while `backend` and `postgres` remain internal-only.
- Evidence: Commit `97fc918` is the implementation that moved the item to review; it updates the renderer Docker build to use lockfile-based installs and adds `.dockerignore`, which addresses the repository-owned Docker configuration rather than relying on manual cleanup. `docker compose config` resolves with only `renderer` publishing port `8080`, while `backend` and `postgres` remain on the internal network without published ports.
- Runtime/Build Check: `npm ci --no-audit --no-fund` in `renderer/` succeeded (`added 15 packages in 5s`), and `npm run build` in `renderer/` succeeded with Vite producing the production bundle. `make compose-reset` could not be executed end-to-end in this sandbox because Docker daemon access is blocked (`permission denied while trying to connect to the Docker daemon socket`), so Compose verification here is limited to static config resolution via `docker compose config`.
- Residual Risk: End-to-end `make compose-reset` execution was not directly reproducible in this sandbox due Docker socket restrictions, but no repository-level issue was found in the Compose topology or the renderer build path changed by the implementation.
