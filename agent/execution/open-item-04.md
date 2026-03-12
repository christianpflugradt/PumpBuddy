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
