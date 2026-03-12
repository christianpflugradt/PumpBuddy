# Item 0005: Finish And Cancel The Workout Flow

## Goal

Finalize the workout-level actions so cancellation remains available throughout the exercise flow and finishing the last exercise follows the same confirmation rules as forward navigation.

## Scope

- keep workout cancellation available from the exercise flow
- expose workout completion on the last exercise as a distinct action from set completion and exercise navigation
- apply the same non-blocking confirmation pattern to `Finish Workout` when no set has been completed yet or when the editable row has been modified
- ensure workout completion never persists an unfinished editable row unless the user explicitly completed that set first

## Acceptance Criteria

- cancellation remains available from the workout exercise flow and uses the existing persisted-workout cancellation path
- `Finish Workout` is available on the last exercise only and stays separate from the set completion action
- finishing the workout proceeds without confirmation only when at least one set is completed on the current exercise and the editable row still matches suggested values
- finishing the workout shows a confirmation dialog when no set has been completed yet or when the editable row has been modified
- `cargo test active_workout` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0004`

## Notes for Review

- confirm the final completion path preserves the rule that only completed sets are persisted


## Review Findings

### Criterion

Finish workout uses the same non-blocking confirmation pattern as forward navigation when no set has been completed yet.

- Status: fail
- Evidence: In `renderer/src/app.ts`, `finishWorkout()` allows the confirmed no-completed-set path and calls `completeWorkout(state.workoutPlan)` without first materializing a completed set ([renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1152), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1174)). `completeWorkout()` then calls `createActiveWorkout()` when no persisted workout exists, but `buildActiveWorkoutProgressPayload()` only includes exercises that already have `completedSets` ([renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1080), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1101), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L406)). For a single-exercise workout finished after confirmation with zero completed sets, that produces `exercises: []`, and the backend rejects it because active workout payloads must include at least one confirmed exercise and each included exercise must include at least one completed set ([backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L676), [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L704)). The new renderer tests cover confirmed finish with a modified draft only when an earlier exercise already exists in the payload, and they do not exercise this single-exercise zero-completed-set case ([renderer/src/app.test.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.test.ts#L445), [renderer/src/app.test.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.test.ts#L965)).
- Risk: On a one-exercise workout, `Finish Workout` is still blocking in the exact scenario the item was meant to support: after the user confirms discarding an uncompleted draft, the save path fails instead of completing the workout. That leaves the flow inconsistent with the item goal and with the backend contract.


## Review Acceptance

- Criteria Met: Cancellation remains on the exercise flow through the persisted active-workout path; `Finish Workout` renders only on the last exercise as a separate action; finish reuses the forward-navigation confirmation rules and discards unfinished drafts unless the user explicitly completed the set first.
- Evidence: In [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1061), [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1174), and [renderer/src/app.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.ts#L1114), finish now branches to `/api/workouts` when no confirmed exercises exist, while active-workout payloads continue to include only completed sets via `buildActiveWorkoutProgressPayload`; this preserves the rule that unfinished editable rows are never persisted. The committed coverage in [renderer/src/app.test.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/app.test.ts#L1080) exercises the single-exercise confirm-and-discard finish path, and [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L672) plus [backend/src/main.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/main.rs#L1652) preserve the active-workout validation while explicitly allowing empty `CreateWorkoutRequest.exercises` for this completion case.
- Runtime/Build Check: `cargo test active_workout` in `/Users/cpf/Workspace/personal/PumpBuddy/backend` passed (12 unit tests and 4 integration tests). `npm test` in `/Users/cpf/Workspace/personal/PumpBuddy/renderer` passed (19 tests), including `createApp confirms finish and discards an uncompleted draft on a single-exercise workout`.
- Residual Risk: none identified
