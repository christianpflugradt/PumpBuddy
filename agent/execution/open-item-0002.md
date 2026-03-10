# Item 0002 - Static Workout Wizard Navigation

## Goal

Implement a client-side wizard that steps through exactly five hardcoded exercises without full page reload and supports forward/backward navigation.

## Scope

- define one static `Push Day` workout plan in renderer state with exactly five realistic English exercise names
- start the wizard from the start screen action and display one exercise step at a time
- implement step navigation controls for previous and next movement across exercises
- keep exercise-step transitions in one continuous SPA-like renderer flow (no full page refresh)

## Acceptance Criteria

- starting from `Start Workout` enters an exercise step view in the same page session
- the flow contains exactly five exercises and only one exercise is visible at a time
- users can navigate forward and backward between exercise steps and see the corresponding exercise content update
- `cd renderer && npm run build` exits successfully

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-0001`
