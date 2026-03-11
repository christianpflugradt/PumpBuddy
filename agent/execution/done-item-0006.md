# Submit Completed Workout From Renderer

## Goal

Finish the vertical slice by posting the completed workout from the renderer to the backend and covering the end-to-end persistence path with automated tests.

## Scope

- build the renderer payload from the selected plan, selected gym, and edited exercise weights
- submit the payload on workout completion and gate the success screen on API success
- show a minimal error state if workout save fails
- add or update automated tests that cover the backend persistence path and the renderer happy path for completion

## Acceptance Criteria

- completing the last exercise sends a backend API request instead of switching to success locally without persistence
- the success state renders only after the backend confirms the workout was created
- automated tests verify that the scoped flow persists `workouts`, `workout_exercises`, and `workout_sets` as intended
- executable verification: `cd backend && cargo test create_workout`
- executable verification: `cd renderer && npm test`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/design/api-contract.yaml`
- `renderer/src/app.ts`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/init.sql`

## Dependencies

- `item-0003`
- `item-0004`
- `item-0005`

## Notes for Review

- keep test additions focused on this slice's persistence and renderer submission behavior


## Review Acceptance

- Criteria Met: Renderer completion now builds and submits `CreateWorkoutRequest` from the selected plan, gym, and edited weights, only transitions to the completion screen after successful API completion, shows a save error on failure, and automated tests cover renderer submission plus backend persistence of `workouts`, `workout_exercises`, and `workout_sets`.
- Evidence: `renderer/src/app.ts` builds the payload with per-exercise weights and fixed reps, calls `submitWorkout` from the last exercise, and gates `viewState` completion on awaited success while preserving an error state on failure. `renderer/src/app.test.ts` verifies submission happens before success render and verifies the save-failure path. `backend/src/persistence.rs` persists workout, workout exercises, and workout sets in one transaction, and `backend/tests/persistence_integration.rs` verifies one set per exercise is persisted with expected placeholder `NULL` selections and counts of 2 workout exercises / 2 workout sets.
- Runtime/Build Check: `cd backend && cargo test create_workout` -> passed (`create_workout_round_trip_hydrates_sets` and `create_workout_persists_one_set_per_exercise_with_placeholder_nulls` succeeded). `cd renderer && npm test` -> passed (9 tests passed, 0 failed).
- Residual Risk: Low; the renderer coverage is unit-level rather than browser E2E, but it exercises the scoped completion/save state machine and payload construction directly.
