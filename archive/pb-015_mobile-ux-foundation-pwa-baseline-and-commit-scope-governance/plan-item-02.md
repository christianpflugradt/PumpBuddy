# Plan: Promote Complete Set Action Hierarchy

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Make `Complete Set` the dominant exercise-screen action while keeping navigation available as secondary actions and keeping cancel-workout visually de-emphasized.

## Implementation Approach

- Update `renderer/src/workout-render.ts` action markup so `Complete Set` is rendered in a primary full-width row, with previous/next controls grouped in a secondary row and cancel in a tertiary placement.
- Adjust `renderer/src/styles.scss` action layout and button styles to reinforce hierarchy (primary strongest contrast/size, navigation reduced prominence, cancel subdued).
- Preserve current action availability and disabled-state behavior so hierarchy changes are visual/structural only, not workflow or validation logic changes.
- Ensure mobile and desktop layouts both keep the same hierarchy intent from recommendation 2 in `MOBILE_FIRST_UI_UX_REVIEW.md`.

## Risks and Assumptions

- Assumes existing action handlers (`next-set`, `previous-exercise`, `next-exercise`, `finish-workout`, `cancel-workout`) remain unchanged and only need layout/style updates.
- Risk that responsive CSS ordering could accidentally invert hierarchy on one breakpoint; mitigate by explicit row containers and breakpoint checks.
- Assumes item-01 completed set compaction remains unaffected by action layout changes.

## Validation Plan

- Run `npm --prefix renderer run test` and confirm the suite passes after hierarchy updates.
- Manually verify exercise screen markup/styles on mobile and desktop widths to confirm `Complete Set` is most prominent and full-width.
- Confirm navigation controls remain present/functional and cancel remains available but visually tertiary when eligible.

## Out of Scope

- Changing action semantics, save flow timing, or navigation business logic.
- Introducing new workout actions or altering confirmation dialog behavior.
- Implementing additional UX recommendations beyond hierarchy emphasis for this item.

## Handoff Notes for Implementation

- Keep this item aligned with acceptance criteria in `agent/execution/open-item-02.md`; do not expand scope.
- Keep recommendation 2 fidelity explicit in implementation and review notes.
