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
