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
