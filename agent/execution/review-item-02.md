# Clarify Workout Action Dialog Labels

## Goal

Replace generic workout confirmation dialog action labels with explicit action-specific wording for faster decisions.

## Scope

- update confirmation dialogs to use explicit labels such as `Finish Workout`, `Cancel Workout`, and `Skip Exercise`
- preserve existing dialog trigger behavior and safety prompts while changing wording
- apply label updates consistently across workout flow confirmation points

## Acceptance Criteria

- workout confirmation dialogs no longer use generic labels like `Confirm` for the targeted actions
- action labels communicate exact outcomes for finish, cancel, and skip flows
- running `npm --prefix renderer run build` succeeds after dialog label updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`

## Dependencies

- `item-01`

## Notes for Review

- validate recommendation 6 from `MOBILE_FIRST_UI_UX_REVIEW.md`
