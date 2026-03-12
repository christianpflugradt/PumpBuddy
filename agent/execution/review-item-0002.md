# Item 0002: Complete Sets Without Exercise Navigation

## Goal

Replace the faulty set action so confirming a set only completes the current set on the current exercise, persists that completed set immediately, and opens a fresh draft row for the next set.

## Scope

- replace the current `Next Set` behaviour with an explicit set completion action on the active exercise
- ensure completing a set persists only the newly completed set state for the current exercise
- create a new editable draft row after a set is completed using the completed set as the next suggestion
- add or update tests that protect the regression where the set action incorrectly advances to another exercise

## Acceptance Criteria

- completing a set adds a read-only completed row on the current exercise and does not navigate to another exercise
- after a set is completed, a fresh editable row is shown for the next set with suggested values derived from the just-completed set
- completed-set progress is persisted immediately when the set is confirmed, while the new draft row remains unpersisted until later confirmation
- `cargo test active_workout` passes

## References

- `agent/strategy/plan.md`
- `agent/design/use-cases.md`
- `agent/design/api-contract.yaml`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0001`

## Notes for Review

- review should explicitly confirm that the set action stays on the same exercise in both UI behaviour and persistence tests
