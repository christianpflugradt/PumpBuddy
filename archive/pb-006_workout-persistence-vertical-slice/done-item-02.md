# Add Gym Selection Read Path

## Goal

Expose seeded gyms through the backend so the renderer can load selectable start-of-workout gym options from the API instead of hardcoding them.

## Scope

- add the backend domain and persistence shapes needed to return gym summaries
- implement a repository method that reads seeded gyms from PostgreSQL
- add an Axum `GET /api/gyms` handler that returns the gym summaries in a stable order
- keep the endpoint read-only and within the existing renderer-to-backend boundary

## Acceptance Criteria

- the backend exposes `GET /api/gyms` and returns gym summary JSON sourced from PostgreSQL seed data
- the persistence layer has a dedicated query for gym summaries instead of embedding SQL directly in the handler
- the response shape matches the canonical OpenAPI contract for this slice
- executable verification: `cd backend && cargo test gyms`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/security.md`
- `agent/design/api-contract.yaml`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`
- `backend/init.sql`

## Dependencies

- `item-01`


## Review Acceptance

- Criteria Met: `GET /api/gyms` is exposed in the Axum router, returns gym summary JSON sourced through `DomainRepository::fetch_gym_summaries`, and the response shape matches the canonical `GymSummary` contract (`id`, `name`) with stable ordering from PostgreSQL seed data.
- Evidence: [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L143) registers `GET /api/gyms` and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L206) maps repository results into `{ id, name }` JSON; [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L176) defines the dedicated gyms query with `ORDER BY created_at ASC, id ASC`; [backend/src/domain.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/domain.rs#L16) defines the `GymSummary` domain shape matching [api-contract.yaml](/Users/cpf/Workspace/personal/PumpBuddy/agent/design/api-contract.yaml#L22).
- Runtime/Build Check: Executed `cd backend && cargo test gyms`; observed result: 2 targeted tests passed (`fetch_gym_summaries_returns_seed_gyms_in_stable_order` and `gyms_read_path_returns_seeded_summaries_in_stable_order`), 0 failed.
- Residual Risk: No endpoint-level HTTP test currently exercises `/api/gyms` through the Axum router, so handler wiring is covered by static inspection plus repository tests rather than a request/response integration test.
