# Relax Mobile Numeric Input Validation

## Goal

Allow temporary intermediate numeric input states during mobile typing and normalize values at completion boundaries.

## Scope

- adjust workout numeric input handling to permit intermediate typing states (for example transient empty or partial values)
- normalize and validate values on blur, save, and complete-set actions
- preserve final persisted data constraints and workout logging correctness

## Acceptance Criteria

- users can type intermediate numeric states without immediate disruptive validation resets
- numeric values are normalized and validated when input focus leaves fields or when save/complete-set actions occur
- running `npm --prefix renderer run test` succeeds after input handling changes

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`

## Dependencies

- `item-03`

## Notes for Review

- validate recommendation 8 from `MOBILE_FIRST_UI_UX_REVIEW.md`
