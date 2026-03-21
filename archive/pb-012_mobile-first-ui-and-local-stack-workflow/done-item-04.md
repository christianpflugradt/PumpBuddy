# Makefile Stack Commands

## Goal

Add reproducible Makefile commands for starting and fully reinitializing the local Docker Compose stack.

## Scope

- add a `make compose-up` target for starting the local stack
- add a `make compose-reset` target that rebuilds images, clears prior state, restarts the stack, and reapplies `init.sql`
- keep the workflow explicit and aligned with the existing renderer-public and backend/database-private container topology

## Acceptance Criteria

- `make compose-up` starts the Compose stack through a single repository-level command
- `make compose-reset` fully rebuilds and reinitializes the local stack from clean state, including application of `init.sql`
- `make compose-up` and `make compose-reset` execute successfully in a correctly provisioned local Docker environment

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security.md`

## Out of Scope

- README documentation for the new commands
- unrelated Compose architecture changes


## Review Acceptance

- Criteria Met: `make compose-up` provides a single repository-level command for starting the stack, and `make compose-reset` tears down containers and volumes, rebuilds images without cache, and recreates the stack so the Postgres init bind mount reapplies `backend/init.sql` on fresh database startup.
- Evidence: [Makefile](/Users/cpf/Workspace/personal/PumpBuddy/Makefile) adds `compose-up` and `compose-reset` as phony repository-level targets. `compose-reset` runs `docker compose down --volumes --remove-orphans`, `docker compose build --no-cache`, and `docker compose up -d --force-recreate`, which clears prior Postgres state and recreates the stack. [compose.yaml](/Users/cpf/Workspace/personal/PumpBuddy/compose.yaml) keeps only `renderer` exposed on `8080` and mounts [backend/init.sql](/Users/cpf/Workspace/personal/PumpBuddy/backend/init.sql) into `/docker-entrypoint-initdb.d/init.sql`, so a fresh Postgres volume triggers reinitialization through that script.
- Runtime/Build Check: `docker compose config` exited successfully and rendered the expected stack with `backend/init.sql` mounted into the `postgres` service; `make -n compose-reset` also printed the expected reset sequence. Live `docker compose up` execution could not be completed in this sandbox because access to `/Users/cpf/.rd/docker.sock` is denied.
- Residual Risk: Live daemon-backed execution was not revalidated in this sandbox, but no implementation issue was identified in the committed targets or Compose wiring.
