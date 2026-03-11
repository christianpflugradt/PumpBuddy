# Resume Persisted Workouts on Reload

## Goal

Restore an unfinished active workout automatically when the application loads so the user re-enters the current step instead of seeing the start screen.

## Scope

- load active workout state during application startup
- route directly into the in-progress workout when an unfinished persisted workout exists
- reconstruct the current exercise position and visible state from the backend response
- add or update frontend tests that cover the automatic resume behavior

## Acceptance Criteria

- loading the application with no active persisted workout keeps the normal start screen behavior
- loading the application with an unfinished persisted workout bypasses the start screen and restores the user to the correct next exercise
- the renderer does not expose a separate manual "resume workout" control on the start screen
- `npm test` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/renderer`

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`
- `renderer/src/app.ts`

## Dependencies

- `item-0003`
- `item-0004`

## Out of Scope

- repairing invalid multiple-active-workout data beyond using the first result from the backend


## Review Acceptance

- Criteria Met: The renderer keeps the normal start screen when `/api/active-workout` returns 404, resumes directly into the correct exercise when an unfinished active workout exists, reconstructs the workout plan and persisted weights from the backend response plus training-plan options, avoids any manual resume control on the start screen, and includes renderer tests for the startup resume path.
- Evidence: `loadActiveWorkout` treats a 404 active-workout lookup as the no-resume case, `bootstrapStartScreen` checks that endpoint first and sets `viewState` to the persisted `current_exercise_position`, `buildWorkoutPlanFromActiveWorkout` restores persisted exercise data into the rebuilt plan, and the committed tests cover both the empty-startup path and the automatic resume path.
- Runtime/Build Check: `cd renderer && npm test` -> passed with 16 tests, 0 failures on 2026-03-11.
- Residual Risk: none identified
