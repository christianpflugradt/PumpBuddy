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

- `item-0001`
