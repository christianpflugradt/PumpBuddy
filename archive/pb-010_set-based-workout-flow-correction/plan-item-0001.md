# Plan: Render Set-Oriented Exercise Rows

## Item Reference

- `agent/execution/open-item-0001.md`

## Goal Summary

Update the workout exercise screen so completed sets and the active draft set share the same compact row layout, with load and reps controls shown side by side only on the editable bottom row.

## Implementation Approach

- Inspect the current workout exercise screen components and styles to identify where completed sets and the draft set are rendered separately today.
- Refactor the set row rendering so completed and editable rows reuse one row structure, with row state controlling whether values are read-only or interactive.
- Update the editable row controls to place load and reps controls next to each other within the row while keeping completed rows free of editing affordances.
- Adjust frontend tests to cover the shared row layout and the editable-only controls without expanding item scope into workflow changes.

## Risks and Assumptions

- The current screen may split completed and editable rows across different components, so the main risk is introducing layout drift while consolidating markup.
- Styling changes need to preserve a clear distinction between completed and editable rows through affordances rather than separate structural patterns.
- This plan assumes no backend or persistence changes are needed because the item is limited to rendering and interaction layout.

## Validation Plan

- Run `npm --prefix frontend test -- --run`.
- Manually verify the exercise screen markup and styling logic to confirm the draft set remains the bottom row and completed rows are read-only.

## Out of Scope

- changes to set completion persistence behaviour
- changes to exercise navigation rules

## Handoff Notes for Implementation

- Keep user-facing copy in English.
- Stay within the existing frontend stack and component patterns; do not introduce new framework dependencies.
