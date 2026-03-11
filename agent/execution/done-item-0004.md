# Persist Workout Progress From the Existing Flow

## Goal

Connect the existing exercise-by-exercise renderer flow to the backend so workout progress is first persisted on the first confirmed weight entry and updated after each later confirmation.

## Scope

- keep the current step-by-step workout interaction model intact while wiring it to the new active workout API
- ensure no persistence call is made before the first confirmed exercise weight
- update the local renderer state from backend responses so later steps stay aligned with persisted progress
- add or update frontend tests for the incremental persistence behavior

## Acceptance Criteria

- starting a workout without confirming the first exercise leaves no persisted active workout request in the normal flow
- confirming the first exercise triggers the initial persistence call and later confirmations trigger update calls instead of restarting the workout
- the renderer continues advancing one exercise at a time with no added resume control on the start screen
- `npm test` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/renderer`
- `npm run lint` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/renderer`

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/use-cases.md`
- `renderer/src/app.ts`

## Dependencies

- `item-0002`
- `item-0003`

## Out of Scope

- automatic reload recovery
- workout cancellation UI


## Review Acceptance

- Criteria Met: The renderer keeps the existing step-by-step workout flow, does not call the active-workout API before the first confirmed weight, creates the active workout on the first confirmation, updates it on later confirmations, and completes the workout without adding any resume control on the start screen.
- Evidence: `persistExerciseConfirmation` only runs from the `next` action on the exercise screen, so starting a workout alone produces no persistence call; the first non-final confirmation branches to `createActiveWorkout`, later confirmations branch to `updateActiveWorkout`, and the UI advances with `getNextViewState` while syncing local plan state from backend responses via `applyActiveWorkoutResponse` in `renderer/src/app.ts`. The renderer tests in `renderer/src/app.test.ts` cover the no-call-before-confirmation boundary, create/update/complete sequencing, and response-driven state sync.
- Runtime/Build Check: `npm test` in `/Users/cpf/Workspace/personal/PumpBuddy/renderer` passed with 11 tests green; `npm run lint` in the same directory completed successfully.
- Residual Risk: none identified
