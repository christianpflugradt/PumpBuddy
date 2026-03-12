# Item 0003: Gate Exercise Navigation With Draft Confirmation

## Goal

Make exercise navigation distinct from set completion by allowing forward movement only after completed work exists and by requiring confirmation when the current draft row is incomplete or modified.

## Scope

- keep `Next Exercise` as a navigation-only action that never persists the current editable draft row
- allow forward navigation only after at least one completed set exists for the current exercise
- show a confirmation dialog before forward navigation when no set has been completed yet or when the editable row differs from its suggested values
- allow backward navigation only up to the first exercise

## Acceptance Criteria

- `Next Exercise` never persists an unfinished editable row
- forward navigation proceeds without confirmation only when the current exercise already has a completed set and the editable row still matches suggested values
- forward navigation shows a confirmation dialog when no set has been completed yet or when the editable row has been modified
- backward navigation is available until the first exercise and is disabled or hidden on the first exercise
- `npm --prefix frontend test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0002`

## Out of Scope

- restoring previously visited exercise state after navigation
- finish-workout confirmation rules

## Notes for Review

- verify navigation confirmation is non-blocking and does not write draft state to the backend
