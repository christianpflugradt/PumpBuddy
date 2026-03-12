# Deliver Multi-Set Exercise Flow In The Renderer

## Goal

Update the exercise screen so the user can complete multiple sets per exercise with editable suggested inputs and read-only history for earlier sets.

## Scope

- change the renderer workout flow to show completed sets for the current exercise as read-only history on the same exercise screen
- use backend-provided recommendation values to prefill the editable set inputs for the first set and later sets in the same exercise
- persist the current completed set when the user starts the next set or advances to the next exercise, while preventing edits to earlier sets and earlier exercises after advancement
- add or update renderer tests for the multi-set progression behaviour

## Acceptance Criteria

- the renderer keeps one screen per exercise while displaying prior completed sets for that exercise as non-editable history
- the editable inputs for a new set start from the previous set in the same exercise when one exists, otherwise from the backend recommendation for historical data or the backend fallback defaults
- advancing to another set or the next exercise triggers the active-workout persistence flow without introducing an extra confirmation screen
- `npm test --prefix renderer` passes

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`
- `agent/design/use-cases.md`
- `agent/design/api-contract.yaml`

## Dependencies

- `item-0001`

## Notes for Review

- Review should verify both the UI behaviour and the request timing around set advancement, not just the rendered text.
