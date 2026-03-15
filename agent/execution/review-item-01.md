# Implement Compact Completed-Set Rows

## Goal

Reduce vertical space usage in the workout exercise screen by rendering completed sets as compact single-line rows.

## Scope

- replace card-style completed-set history entries with a row-based layout
- keep only the current editable set expanded while completed sets remain collapsed
- ensure completed-set history appears below the current set area

## Acceptance Criteria

- completed sets render in a compact row format that materially reduces vertical usage compared with the previous card format
- the active set remains the only expanded editable region while previously completed sets stay collapsed
- running `npm --prefix renderer run build` succeeds after the layout changes

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/workout-render.ts`
- `renderer/src/styles.scss`

## Notes for Review

- validate recommendation 1 from `MOBILE_FIRST_UI_UX_REVIEW.md` is implemented in source-priority order
