# Cancel Unfinished Active Workouts

## Goal

Add cancellation support for unfinished persisted workouts, including backend cleanup and an English confirmation flow in the renderer.

## Scope

- implement the backend cancellation path that deletes all persisted records for an unfinished workout
- add a renderer cancellation action that is available only for unfinished persisted workouts
- show an English confirmation prompt that clearly states the unfinished workout data will be deleted
- cover cancellation behavior with backend and frontend tests

## Acceptance Criteria

- cancelling an unfinished persisted workout deletes its persisted records and returns the application to the start screen
- the cancellation action is unavailable before the first persisted confirmation and unavailable after the workout is completed
- the confirmation prompt shown to the user is written in English
- `cargo test` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/backend`
- `npm test` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/renderer`

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `renderer/src/app.ts`

## Dependencies

- `item-03`
- `item-05`

## Out of Scope

- cancellation of completed workouts
- introducing a broader workout history deletion feature


## Review Acceptance

- Criteria Met: Cancelling an unfinished persisted workout deletes persisted workout, exercise, and set records and returns the UI to the start screen; the cancel action is hidden before the first persisted confirmation and unavailable after completion; the confirmation prompt is written in English; `cargo test` and `npm test` both succeed.
- Evidence: The backend exposes `DELETE /api/active-workout/{workout_id}` and delegates to repository cancellation logic that rejects completed workouts and deletes unfinished persisted workouts from `workouts`, which cascades persisted child records via the existing schema behavior in [persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L438). API coverage verifies unfinished cancellation and completed-workout rejection in [main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L1496). Repository integration coverage verifies persisted workout, exercise, and set records are removed in [persistence_integration.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/tests/persistence_integration.rs#L697). The renderer only renders `Cancel Workout` when `activeWorkout.id !== null` and at least one exercise has been persisted, confirms with the English prompt `Cancel this workout? Your unfinished workout data will be deleted.`, and reloads the start-screen selections after successful cancellation in [app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L490) and [app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L799). Renderer tests cover visibility, confirmation acceptance, rejection, and reset-to-start behavior in [app.test.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.test.ts#L731).
- Runtime/Build Check: `cargo test` in `/Users/cpf/Workspace/personal/PumpBuddy/backend` passed with 18 total tests across unit, API, and integration suites; `npm test` in `/Users/cpf/Workspace/personal/PumpBuddy/renderer` passed with 18 tests and 0 failures.
- Residual Risk: none identified
