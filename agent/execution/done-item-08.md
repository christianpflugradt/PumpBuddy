# Strengthen Workout Typography Hierarchy

## Goal

Apply a clearer typography scale so workout titles, exercise names, labels, and numeric inputs communicate hierarchy at a glance.

## Scope

- implement typography sizing and emphasis updates for app title, exercise name, labels, and input numbers
- ensure numeric weight/rep values visually emphasize strong mechanical readability
- keep typography changes consistent with existing mobile layout spacing constraints

## Acceptance Criteria

- workout UI typography reflects a stronger hierarchy aligned to recommendation targets for title, exercise, labels, and input values
- numeric workout inputs are visually emphasized relative to labels and helper text
- running `npm --prefix renderer run build` succeeds after typography updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/styles.scss`

## Dependencies

- `item-07`

## Notes for Review

- validate recommendation 12 from `MOBILE_FIRST_UI_UX_REVIEW.md`


## Review Acceptance

- Criteria Met: Workout title, exercise name, labels, and numeric values use a clearer hierarchy, numeric set values are emphasized over labels/helper text, and the required renderer build succeeds.
- Evidence: `renderer/src/styles.scss` sets `.app-title` to `clamp(1.9rem, 6vw, 2rem)` with stronger weight, `.exercise-name` to `clamp(1.45rem, 4.6vw, 1.55rem)` with stronger weight, tightens label styling in `.set-row-field-label` to `0.75rem` uppercase with wider tracking, and emphasizes numeric values in `.set-row-field-value` and `.weight-input` via larger size, heavier weight, and `font-variant-numeric: tabular-nums`.
- Runtime/Build Check: Executed `npm --prefix renderer run build`; observed successful Vite production build (`✓ built in 3.26s`) with generated assets in `renderer/dist`.
- Residual Risk: none identified
