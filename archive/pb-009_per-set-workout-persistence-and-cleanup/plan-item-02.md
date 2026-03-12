# Plan: Deliver Multi-Set Exercise Flow In The Renderer

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Update the renderer workout flow so a single exercise screen supports progressing through multiple sets, keeps earlier sets visible as read-only history, and persists progress when the user advances within or beyond the exercise.

## Implementation Approach

- Inspect the current renderer workout state, exercise screen components, and active-workout persistence flow to identify where set progression is currently limited to one editable set.
- Extend renderer state shaping so each exercise screen can render completed sets as immutable history while keeping exactly one active editable set derived from either the previous set values or backend recommendations and fallbacks.
- Update the exercise advancement handlers so moving to the next set or next exercise persists the active set through the existing backend flow without adding an intermediate confirmation step.
- Add or update renderer tests that verify prefilled values, read-only history behaviour, and persistence timing during set-to-set and exercise-to-exercise advancement.

## Risks and Assumptions

- The renderer may already couple screen progression tightly to exercise advancement, so introducing intra-exercise set advancement may require careful state changes to avoid regressions in the existing persistence flow.
- Backend responses are assumed to already provide enough recommendation data to seed the first set and to support fallback defaults when historical data is absent.
- Test updates may need to assert request timing or payload details rather than only rendered content, as called out by the item notes.

## Validation Plan

- Run `npm test --prefix renderer`.
- Verify the updated renderer tests cover completed-set history, editable value prefilling for new sets, and persistence on advancement.

## Out of Scope

- Changing backend API scope or acceptance criteria beyond consuming the existing recommendation and persistence contract.
- Introducing extra confirmation UI or allowing edits to completed sets or previous exercises.

## Handoff Notes for Implementation

- Keep the renderer aligned with backend-persisted progress as the source of truth.
- Preserve the one-screen-per-exercise flow while distinguishing clearly between historical sets and the active editable set.
