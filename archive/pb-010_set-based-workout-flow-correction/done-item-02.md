# Item 0002: Complete Sets Without Exercise Navigation

## Goal

Replace the faulty set action so confirming a set only completes the current set on the current exercise, persists that completed set immediately, and opens a fresh draft row for the next set.

## Scope

- replace the current `Next Set` behaviour with an explicit set completion action on the active exercise
- ensure completing a set persists only the newly completed set state for the current exercise
- create a new editable draft row after a set is completed using the completed set as the next suggestion
- add or update tests that protect the regression where the set action incorrectly advances to another exercise

## Acceptance Criteria

- completing a set adds a read-only completed row on the current exercise and does not navigate to another exercise
- after a set is completed, a fresh editable row is shown for the next set with suggested values derived from the just-completed set
- completed-set progress is persisted immediately when the set is confirmed, while the new draft row remains unpersisted until later confirmation
- `cargo test active_workout` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-01`

## Notes for Review

- review should explicitly confirm that the set action stays on the same exercise in both UI behaviour and persistence tests


## Review Acceptance

- Criteria Met: The set completion action now keeps the user on the current exercise, renders the completed set as a read-only row, opens a fresh editable draft row seeded from the completed set, persists only completed sets immediately, and preserves canonical exercise positions and current exercise position in active-workout persistence.
- Evidence: `renderer/src/app.ts` keeps `exerciseIndex` unchanged when `advance === "set"` and labels the action `Complete Set`, while `buildActiveWorkoutProgressPayload` preserves original exercise `position` values for persisted progress. `renderer/src/app.test.ts` verifies same-exercise completion, read-only history, and preserved exercise positions. `backend/src/main.rs`, `backend/src/persistence.rs`, and `backend/init.sql` add `current_exercise_position` to active-workout persistence and hydration so resuming or updating after completing a set does not advance to another exercise based on contiguous completed rows.
- Runtime/Build Check: `cargo test active_workout` in `backend` passed with 15 tests run and 0 failed (11 `src/main.rs` active-workout tests and 4 persistence integration tests). Additional focused renderer check `npm test -- --runInBand --testNamePattern='buildActiveWorkoutProgressPayload preserves original exercise positions|createApp completes sets on the same exercise before advancing exercises and completing'` in `renderer` passed with 14 tests passed and 0 failed.
- Residual Risk: none identified
