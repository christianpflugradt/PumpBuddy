# Persist Completed Workouts In Repository

## Goal

Implement the backend repository write path that stores one completed workout, its workout exercises, and one workout set per exercise in PostgreSQL.

## Scope

- add or refine backend domain input types needed for completed workout creation
- implement a transactional repository method that inserts `workouts`, `workout_exercises`, and `workout_sets`
- satisfy required schema fields with `NULL` or explicit temporary dummy references where the renderer does not yet collect real values
- add clear backend code comments where temporary dummy values or placeholders must be replaced by future real user selections

## Acceptance Criteria

- the repository can create a completed workout tied to a selected training plan and gym
- each submitted exercise produces exactly one persisted `workout_exercises` row and one persisted `workout_sets` row
- required temporary dummy-value handling is explicit in backend code comments rather than implicit
- executable verification: `cd backend && cargo test create_workout`

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/design/domain-model.md`
- `agent/design/api-contract.yaml`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`
- `backend/init.sql`

## Dependencies

- `item-01`

## Out of Scope

- incremental set-by-set persistence during workout execution
- workout history queries beyond the existing summary read path


## Review Acceptance

- Criteria Met: The backend defines `NewWorkout` input types for completed workout creation, persists a workout plus `workout_exercises` and `workout_sets` transactionally, ties the workout to the submitted training plan and gym, creates one exercise row and one set row per submitted scoped exercise in the integration test, and documents temporary `NULL` placeholder handling for selection fields and reps.
- Evidence: `backend/src/persistence.rs` implements `create_workout` with a single SQLx transaction that inserts `workouts`, then `workout_exercises`, then `workout_sets`, with explicit placeholder comments on nullable selection fields and reps. `backend/tests/persistence_integration.rs` verifies two submitted exercises persist as two `workout_exercises` rows and two `workout_sets` rows with placeholder selection columns stored as `NULL`.
- Runtime/Build Check: Executed `cd backend && cargo test create_workout`; observed both `persistence::tests::create_workout_round_trip_hydrates_sets` and `create_workout_persists_one_set_per_exercise_with_placeholder_nulls` pass.
- Residual Risk: No blocking issue identified; the accepted slice still relies on temporary nullable selections and reps until later plans collect real user choices.
