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
