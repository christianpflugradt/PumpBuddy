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
- `docker-compose.yml`
- `backend/Dockerfile`
- `renderer/Dockerfile`

## Out of Scope

- broader local-developer experience improvements unrelated to the broken reset workflow
- production deployment changes
