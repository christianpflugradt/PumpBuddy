# Promote Complete Set Action Hierarchy

## Goal

Make `Complete Set` the dominant action on the exercise screen so navigation and cancel actions are visually subordinate.

## Scope

- update exercise-screen action layout so `Complete Set` is full-width and visually primary
- reduce visual prominence of previous/next navigation controls
- de-emphasize cancel-workout affordance relative to primary and secondary actions

## Acceptance Criteria

- `Complete Set` renders as the most prominent action in exercise view hierarchy
- navigation controls remain available but are visually secondary to `Complete Set`
- running `npm --prefix renderer run test` succeeds with updated action hierarchy behavior

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

## Dependencies

- `item-01`

## Notes for Review

- validate recommendation 2 from `MOBILE_FIRST_UI_UX_REVIEW.md` remains faithful to the documented hierarchy
