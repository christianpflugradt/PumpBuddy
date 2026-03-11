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


## Review Findings

### Criterion

invalid or inconsistent input is rejected with an API error response instead of partial writes

- Status: fail
- Evidence: [`backend/src/main.rs:343`](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L343) validates only empty IDs, positions, and set values before constructing `NewWorkout`; it never checks that each `training_plan_exercise_id` belongs to the posted `training_plan_id`. [`backend/src/persistence.rs:288`](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L288) then inserts the workout row and each workout exercise directly by foreign key. The schema only enforces independent foreign keys on `workouts.training_plan_id` and `workout_exercises.training_plan_exercise_id` plus per-workout position uniqueness, with no cross-table constraint tying a workout exercise back to the workout's training plan in [`backend/init.sql:135`](/Users/cpf/Workspace/personal/PumpBuddy/backend/init.sql#L135) and [`backend/init.sql:147`](/Users/cpf/Workspace/personal/PumpBuddy/backend/init.sql#L147). This means a request can pair a valid `training_plan_id` with a `training_plan_exercise_id` from a different plan and still be persisted successfully instead of being rejected as inconsistent input. The required verification command `cd backend && cargo test workout_api` passed, but those tests only cover happy-path creation and basic payload-shape rejection.
- Risk: The API can persist semantically invalid workouts that mix exercises from the wrong plan, breaking the backend's authority over workout integrity and leaving the renderer with apparently successful responses for corrupted data. Because the inserts are wrapped in a transaction, this is not a partial-write bug, but it is still a blocking acceptance failure for inconsistent-input handling.
