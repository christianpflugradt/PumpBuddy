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
