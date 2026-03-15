# Plan: Strengthen Workout Typography Hierarchy

## Item Reference

- `agent/execution/open-item-08.md`

## Goal Summary

Apply a clearer workout typography scale so title, exercise name, labels, and numeric input values are immediately scannable, with numeric values emphasized for strong mechanical readability on mobile.

## Implementation Approach

- Review existing typography selectors in `renderer/src/styles.scss` that map to app title, exercise name, labels, and weight/rep input values.
- Implement recommendation 12 targets with responsive-safe sizing: app title near 32px, exercise name near 24px, labels in compact uppercase style near 12px, and input numbers near 20px with stronger weight.
- Increase visual contrast between labels/helper text and numeric values so workout input values remain the dominant focal point.
- Keep spacing and line-height balanced with current compact mobile layout to avoid overflow, clipping, or control crowding.
- Scope changes to typography tokens/rules only; do not alter item behavior, workflow, or unrelated UI structure.

## Risks and Assumptions

- Exact pixel targets may need clamp-based adaptation to preserve readability across narrow and wider mobile widths.
- Typography emphasis changes can accidentally affect start/completion screens if selectors are shared; scope should stay deliberate.
- Assumes item-07 output is present and current styles already reflect preceding recommendations.

## Validation Plan

- Visually verify hierarchy in workout flow: app title > exercise name > labels/helper text, with numeric input values clearly emphasized.
- Confirm weight/rep number fields are more prominent than associated labels in both editable and read-only set states.
- Verify no mobile layout regressions for the workout screen at narrow widths (including line wrapping and control alignment).
- Run `npm --prefix renderer run build` and ensure it succeeds.

## Out of Scope

- Copywriting changes or wording updates.
- Interaction behavior changes for workout controls.
- Additional UI/UX enhancements outside recommendation 12.

## Handoff Notes for Implementation

- Prioritize workout-step selectors (`.app-title`, `.exercise-name`, label styles, and `.weight-input`) before considering broader typography reuse.
- Prefer adjusting existing rules over introducing new style architecture.
- If exact recommendation values conflict with mobile constraints, preserve hierarchy intent and document rationale in implementation output.
