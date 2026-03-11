# Add Workout Completion API Handler

## Goal

Expose the completed-workout write path through the backend API so the renderer can create workouts through HTTP instead of local-only state transitions.

## Scope

- add request and response DTOs for workout creation in `backend/src/main.rs`
- implement an Axum `POST /api/workouts` handler that validates the minimal payload and calls the repository write path
- return a stable success response that the renderer can use for the completion state
- map validation, not-found, and internal failures into actionable API responses without leaking internal details

## Acceptance Criteria

- the backend router exposes `POST /api/workouts`
- the handler delegates persistence to the repository layer rather than embedding database logic in the route
- invalid or inconsistent input is rejected with an API error response instead of partial writes
- executable verification: `cd backend && cargo test workout_api`

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security-baseline.md`
- `agent/design/api-contract.yaml`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`

## Dependencies

- `item-0001`
- `item-0003`
