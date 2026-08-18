# Item 0004: Preserve Exercise State Across Navigation

## Goal

Preserve per-exercise workout state so revisiting exercises restores completed sets and the current draft row while keeping earlier exercises read-only.

## Scope

- preserve the current exercise state when the user moves backward and forward within the workout
- restore completed rows plus the still-editable draft row when returning to the active exercise
- keep previously left exercises visible in read-only form when revisited
- ensure draft state remains local until explicitly completed and is not converted into persisted history during navigation

## Acceptance Criteria

- returning to the current in-progress exercise restores its completed rows and its unconfirmed draft row
- exercises that have already been left remain read-only when revisited
- unfinished edits are preserved locally for the current exercise without being implicitly persisted by navigation
- `npm --prefix frontend test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-03`

## Notes for Review

- check that the restored draft row matches the last local in-progress values rather than a recomputed default


## Review Acceptance

- Criteria Met: Returning to an in-progress exercise restores its local completed rows and editable draft row, revisited earlier exercises render read-only, and navigation-only state remains local because persistence payloads still include only `completedSets`.
- Evidence: [renderer/src/app.ts](renderer/src/app.ts#L245) adds per-exercise `isReadOnly` state and preserves it through cloning; [renderer/src/app.ts](renderer/src/app.ts#L1053) marks an exercise read-only only when leaving it via navigation; [renderer/src/app.ts](renderer/src/app.ts#L406) still builds backend payloads from confirmed `completedSets` only; [renderer/src/app.test.ts](renderer/src/app.test.ts#L690) verifies a revisited earlier exercise is read-only and a later return restores the last local draft values.
- Runtime/Build Check: `npm --prefix frontend test -- --run` completed successfully with 17 tests passed and 0 failed.
- Residual Risk: none identified
