# Plan: Restore Compose Reset Workflow

## Item Reference

- Stable item id: `item-03`

## Goal Summary

Restore the repository-owned Docker workflow so `make compose-reset` completes successfully in the intended local setup without changing the renderer-public/backend-private topology.

## Implementation Approach

- Reproduce the current `make compose-reset` failure with a real Docker daemon and isolate whether the breakage comes from Compose orchestration, image build stages, or container startup ordering.
- Update the affected repository-owned Dockerfiles, Compose service definitions, or reset-related scripts so rebuilds from a clean state succeed without manual cleanup steps.
- Keep the renderer as the only published service and preserve backend/postgres isolation on the internal network while applying the fix.

## Risks and Assumptions

- The root cause may span multiple layers, for example stale build context assumptions, invalid Dockerfile stage usage, or Compose dependency/startup behavior.
- Validation of the final fix requires a local Docker environment; sandboxed execution here cannot talk to the Docker daemon.

## Validation Plan

- Run `make compose-reset` from the repository root and confirm the full reset, rebuild, and recreate flow completes successfully.
- Inspect the resulting Compose topology to confirm only the renderer exposes a host port and backend/postgres remain internal-only.
- Run any targeted follow-up checks needed by the fix, such as `docker compose ps` or service-specific health verification.

## Out of Scope

- Production deployment changes.
- Broader Docker or developer-experience cleanup unrelated to the broken reset workflow.

## Handoff Notes for Implementation

- Prefer the smallest repository-owned change that fixes the local reset workflow durably.
- If the failure is caused by a missing build/runtime prerequisite, encode it in repository configuration rather than relying on undocumented manual steps.
