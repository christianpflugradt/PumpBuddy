# Item 0003 - Weight Input and Step-Level Adjustment Controls

## Goal

Add per-exercise weight entry with numeric-only input and adjacent decrement/increment controls, including distinct default weight suggestions for all five exercises.

## Scope

- provide a numeric-only weight input on each exercise step
- add explicit decrement and increment controls adjacent to the weight input
- initialize each of the five exercises with a distinct prefilled numeric weight suggestion
- persist edited weight values while navigating between previous/next steps inside the wizard flow

## Acceptance Criteria

- each exercise step shows a numeric weight input and adjacent decrement/increment controls
- each of the five exercises starts with a distinct default numeric weight value
- using input and controls updates the current step value, and revisiting a step shows the edited value
- non-numeric characters are rejected by input handling
- `cd renderer && npm run build` exits successfully

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0002`
