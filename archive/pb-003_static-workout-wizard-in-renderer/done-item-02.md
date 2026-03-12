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

- `item-01`


## Review Acceptance

- Criteria Met: `Start Workout` transitions the renderer from start state to exercise state without reload; the plan is a static `Push Day` flow with exactly five exercise entries; only one exercise step is rendered at a time; and `Previous`/`Next` navigation updates the visible exercise content in both directions.
- Evidence: `renderer/src/main.ts` defines five hardcoded exercises in `pushDayPlan.exercises` (lines 13-21), switches to exercise screen on `start-workout` click (lines 108-111), renders a single step from `exerciseIndex` (lines 44-55 and 91-96), and supports bounded backward/forward navigation via `previous`/`next` handlers (lines 132-147).
- Runtime/Build Check: Executed `cd renderer && npm run build` with observed result `vite build` completed successfully (`✓ built in 178ms`, exit code 0).
- Residual Risk: none identified.
