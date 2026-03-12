# Plan: Makefile Stack Commands

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Add repository-level Make targets that wrap the existing Docker Compose stack startup and full local reset flow without changing the current renderer-public/backend-private/postgres-private topology.

## Implementation Approach

- Extend the root `Makefile` with `compose-up` and `compose-reset` phony targets alongside the existing repository-level commands.
- Implement `compose-up` as the standard detached stack startup entry point using the existing `docker-compose.yml` definition.
- Implement `compose-reset` as an explicit clean-state workflow that tears down the stack, removes persisted Compose state, rebuilds images, and starts the stack again so Postgres reapplies `/docker-entrypoint-initdb.d/init.sql` from `backend/init.sql` on fresh volume initialization.
- Keep the reset sequence readable in Make rather than hiding important lifecycle steps in ad hoc scripts unless Make alone becomes too brittle.

## Risks and Assumptions

- Assumes the local environment already has a working Docker Engine and Docker Compose plugin, which is outside repository control.
- Assumes removing the `postgres-data` volume is sufficient for `init.sql` to rerun, since the current Compose file mounts it through the standard Postgres initialization directory.
- Reset semantics should remain limited to local disposable development state; the plan should not imply any production-safe reinitialization path.

## Validation Plan

- Run `make compose-up` and confirm the stack starts successfully in a correctly provisioned local Docker environment.
- Run `docker compose ps` after `make compose-up` and confirm only `renderer` publishes a host port while `backend` and `postgres` stay internal.
- Run `make compose-reset` and confirm it completes the teardown/rebuild/startup flow successfully.
- After `make compose-reset`, verify the stack is healthy and that the database reflects a fresh initialization path from `backend/init.sql`.

## Out of Scope

- README documentation for the new commands.
- Changes to the Compose topology, service boundaries, or non-local deployment workflows.

## Handoff Notes for Implementation

- Prefer `docker compose` over legacy `docker-compose` in new Make targets to match the repository’s current documented commands.
- If verification of `init.sql` application needs a concrete check, use a lightweight database or service-health probe that matches the existing local workflow rather than introducing new tooling.
