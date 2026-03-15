# Improve Workout Error Recovery Guidance

## Goal

Provide recovery-focused workout error messaging that confirms progress safety and tells the user what happens next.

## Scope

- revise workout error and connectivity messages to state whether progress is saved locally
- include clear next-step guidance for temporary connectivity loss
- keep existing error handling flow and retry/sync behavior unchanged unless required for message accuracy

## Acceptance Criteria

- connectivity-related workout errors communicate both data safety status and expected sync/recovery behavior
- updated message content is used in the active workout flow where network disruption is surfaced
- running `npm --prefix renderer run test` succeeds after message updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`

## Dependencies

- `item-02`

## Notes for Review

- validate recommendation 7 from `MOBILE_FIRST_UI_UX_REVIEW.md`
