# Plan: Implement Compact Completed-Set Rows

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Render completed workout sets as compact single-line rows to reduce vertical space while keeping the active set as the only expanded editable area.

## Implementation Approach

- Update workout set history markup in `renderer/src/workout-render.ts` from card-style blocks to concise row entries for completed sets.
- Keep only the current in-progress set rendered with expanded editable controls; render completed sets as collapsed read-only rows.
- Ensure completed-set history remains below the current set section and adjust structure if needed to preserve that order.
- Refine supporting styles in `renderer/src/styles.scss` to enforce tighter spacing, row alignment, and responsive readability on mobile widths.

## Risks and Assumptions

- Existing render logic can distinguish active vs completed sets without introducing additional state.
- Tightening row density may reduce readability if spacing and typography are not balanced on small screens.

## Validation Plan

- Manually verify in the workout exercise screen that completed sets are visually compact single-line rows and the active set is the only expanded editable region.
- Confirm completed-set history is displayed below the active set area across typical viewport sizes.
- Run `npm --prefix renderer run build` and verify it succeeds.

## Out of Scope

- Changes to workout flow behavior, set progression rules, or backend API logic.
- New interactions beyond the completed-set layout compaction requirement.

## Handoff Notes for Implementation

- Preserve the item acceptance criteria as the implementation boundary.
- Prioritize source-level implementation of recommendation 1 from `MOBILE_FIRST_UI_UX_REVIEW.md` during changes and review.
