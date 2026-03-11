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

- `item-0003`
- `item-0005`

## Out of Scope

- cancellation of completed workouts
- introducing a broader workout history deletion feature
