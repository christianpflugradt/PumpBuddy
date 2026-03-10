# Add Targeted Persistence and Initialization Tests

## Goal

Add targeted automated tests that validate schema initialization and primary SQLx persistence behavior for pb-004.

## Scope

- add backend integration tests that run against PostgreSQL and validate:
  - initialization from `backend/init.sql`
  - required seed invariants (gym/plan counts, exercise counts per plan, variant-option differences)
  - representative persistence read/write paths for workouts and sets
- keep test coverage focused on high-value persistence behaviors rather than broad endpoint simulation
- ensure tests are reproducible in local and CI-style environments

## Acceptance Criteria

- integration tests fail when schema/seed invariants for pb-004 are violated
- integration tests cover at least one representative persistence write path and one read path for workout data
- executable verification:
  `cd backend && cargo test`
- executable verification:
  `docker compose up --build -d && docker compose exec -T backend cargo test && docker compose down`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/design/domain-model.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-0003`
- `item-0004`

## Out of Scope

- broad frontend E2E coverage for workout flows
- performance/load testing
