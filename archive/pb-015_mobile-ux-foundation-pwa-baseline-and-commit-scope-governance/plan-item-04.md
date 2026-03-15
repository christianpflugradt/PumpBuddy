# Plan: Recenter Exercise View on Current Set

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Reorder and restyle the exercise screen so the active set interaction (set context, weight/reps controls, and completion action) is the first and strongest visual focus, with completed-set history kept available but secondary.

## Implementation Approach

- Audit `renderer/src/workout-render.ts` exercise-screen markup and identify where current-set and completed-history sections are emitted.
- Restructure the render order so the active set block appears before completed history while preserving existing data and action wiring.
- Group set index/context, weight controls, reps controls, and set-completion action into one contiguous primary interaction container.
- Update `renderer/src/styles.scss` to reinforce hierarchy (spacing, typography scale, and visual weight) so history is visually subordinate.
- Confirm mobile-first readability and tap flow still work in the updated hierarchy.

## Risks and Assumptions

- Assumes existing render/state logic already exposes all active-set data needed without backend or API changes.
- Styling changes may accidentally over-emphasize secondary metadata unless selectors are scoped to the active-set block.
- Reordering DOM sections could affect tests that rely on element order or text grouping.

## Validation Plan

- Run `npm --prefix renderer run test` and fix any failing assertions tied to the new exercise hierarchy.
- Manually verify exercise view shows current set interaction first and completed history beneath it.
- Check recommendation 4 intent from `MOBILE_FIRST_UI_UX_REVIEW.md`: next action should be obvious without scanning secondary content.

## Out of Scope

- Backend/API contract changes.
- New workout behaviors or altered set-completion logic.
- Broad redesign of non-exercise screens.

## Handoff Notes for Implementation

- Keep scope aligned with `open-item-04` acceptance criteria; do not broaden into unrelated UX polish.
- Prefer small, localized renderer markup/style changes that preserve current component boundaries.
