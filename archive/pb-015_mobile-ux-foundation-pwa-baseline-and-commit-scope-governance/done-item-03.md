# Increase Weight/Rep Touch Target Size

## Goal

Improve one-hand mobile usability by raising weight and reps control hit areas to gym-friendly touch target sizes.

## Scope

- increase increment/decrement control dimensions for weight and reps inputs to at least mobile-friendly minimum targets
- add or adjust spacing between controls to reduce accidental taps under fatigue
- keep control semantics and existing workout value update behavior unchanged

## Acceptance Criteria

- weight and reps increment/decrement controls meet a minimum 44px tap target dimension in rendered CSS
- spacing between adjacent weight/rep controls is increased relative to the prior layout and remains consistent across exercise view
- running `npm --prefix renderer run build` succeeds after target size updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

## Dependencies

- `item-02`

## Notes for Review

- validate recommendation 3 from `MOBILE_FIRST_UI_UX_REVIEW.md` using computed styles or responsive inspection at mobile viewport width


## Review Acceptance

- Criteria Met: Weight and reps increment/decrement controls meet at least 44px tap target size in CSS, spacing between adjacent controls is increased from the prior layout, and the renderer build succeeds after the style updates.
- Evidence: `renderer/src/styles.scss` sets `--set-control-target-size: 2.875rem` and applies it to `.weight-controls` columns and `.weight-button` width/height, with `.weight-button` also enforcing `min-width: 44px` and `min-height: 44px`; spacing increased via `.weight-controls` gap `0.4rem -> 0.75rem` and `.set-row-fields` gap `0.65rem -> 0.9rem`, matching recommendation 3 touch target and spacing intent.
- Runtime/Build Check: Executed `npm --prefix renderer run build`; observed Vite production build completed successfully (`✓ built in 636ms`) with generated assets in `renderer/dist`.
- Residual Risk: none identified.
