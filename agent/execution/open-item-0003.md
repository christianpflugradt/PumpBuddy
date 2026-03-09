# Item 0003 - Docker Compose Topology Baseline

## Goal

Provide a project-owned Docker Compose configuration that runs renderer, backend, and PostgreSQL together with the intended exposure boundaries.

## Scope

- add/update `docker-compose.yml` (or equivalent compose file) for renderer, backend, and database services
- wire inter-service networking and startup ordering for stable local runtime startup
- publish only renderer ports and keep backend/database internal-only

## Acceptance Criteria

- `docker compose config` exits successfully with a valid merged configuration.
- `docker compose up --build -d` starts renderer, backend, and database services.
- `docker compose ps` shows renderer as the only service with host port publishing.

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Dependencies

- `item-0001`
- `item-0002`
