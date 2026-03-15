# Plan: Increase Weight/Rep Touch Target Size

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Increase the weight and reps increment/decrement control touch targets to mobile-friendly sizes and improve spacing so one-hand use is more reliable during workouts.

## Implementation Approach

- Update control button sizing in `renderer/src/styles.scss` so each weight/reps increment and decrement control renders at a minimum 44px by 44px target.
- Increase spacing between adjacent controls (buttons and related input group elements) using consistent gap/margin rules applied across the exercise view.
- Keep existing control semantics and workout value update behavior unchanged by limiting changes to presentation-layer CSS and any required non-behavioral markup hooks.

## Risks and Assumptions

- The current markup for weight/reps controls already supports style targeting without structural rewrites.
- Increasing target sizes could affect line wrapping or density on narrow devices; spacing updates should preserve readability and avoid overlap.

## Validation Plan

- Verify via computed styles/responsive inspection at mobile viewport width that the controls render at least 44px by 44px.
- Confirm spacing between adjacent weight/reps controls is visually increased and consistent across exercise rows.
- Run `npm --prefix renderer run build` and confirm success.

## Out of Scope

- Any change to workout value update logic, increment/decrement semantics, or API behavior.
- Broader workout layout redesign beyond touch-target sizing and nearby control spacing.

## Handoff Notes for Implementation

- Prioritize recommendation 3 validation from `MOBILE_FIRST_UI_UX_REVIEW.md` using computed style checks in a mobile viewport.
- Keep changes minimal and localized to the exercise control styling path.
