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

- `item-02`

## Out of Scope

- restoring previously visited exercise state after navigation
- finish-workout confirmation rules

## Notes for Review

- verify navigation confirmation is non-blocking and does not write draft state to the backend


## Review Acceptance

- Criteria Met: `Next Exercise` now routes through navigation-only handlers without calling persistence on intermediate exercises, confirms only when the current draft is incomplete or changed from `suggestedSet`, and adds backward navigation that is disabled on the first exercise. The required test command passes.
- Evidence: In [app.ts](renderer/src/app.ts#L715) the forward-navigation rule is derived from `hasCompletedSets` plus `isDraftModified`. In [app.ts](renderer/src/app.ts#L1015) `navigateToNextExercise()` advances between exercises by updating `viewState` only, with confirmation via `window.confirm(...)` and no API call on non-final exercises; [app.ts](renderer/src/app.ts#L993) adds bounded backward navigation. The committed tests in [app.test.ts](renderer/src/app.test.ts#L442), [app.test.ts](renderer/src/app.test.ts#L773), and [app.test.ts](renderer/src/app.test.ts#L823) cover navigation without persistence, previous-exercise availability, and confirmation when no set is completed or when the draft differs from the suggestion.
- Runtime/Build Check: Executed `npm --prefix frontend test -- --run` and observed `17` tests passing with `0` failures.
- Residual Risk: none identified within this item’s scope; finish-workout confirmation on the last exercise remains explicitly out of scope for item 0003.
