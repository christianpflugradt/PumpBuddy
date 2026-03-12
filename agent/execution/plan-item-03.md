# Plan: True Blocking Modals

## Item Reference

- `agent/execution/open-item-03.md`

## Goal Summary

Make the renderer confirmation dialog behave like a true blocking modal by keeping it visually above the app, dimming and separating background content, and preventing interaction with underlying controls while it is open.

## Implementation Approach

- inspect the current confirmation dialog render path in `renderer/src/app.ts` and its styles in `renderer/src/styles.css` to confirm how the backdrop is mounted relative to the rest of the screen content
- update the renderer markup and CSS so the modal/backdrop establish an explicit overlay layer with reliable stacking, centered dialog presentation, and visible background separation
- ensure background pointer interaction is blocked while the dialog is present, either through the overlay structure itself or by disabling underlying interaction state where the current event wiring would otherwise leak through
- extend `renderer/src/app.test.ts` with assertions that cover the rendered modal structure and the user-visible blocking behavior that changes with the new overlay treatment

## Risks and Assumptions

- the current fake renderer tests primarily inspect rendered HTML, so interaction-blocking coverage may need to focus on the rendered overlay structure plus any state guards that prevent underlying actions while the dialog is open
- the plan assumes the existing confirmation dialog remains the shared dialog pattern in scope for this item rather than introducing a broader dialog framework
- modal fixes should stay focused on layering and interaction blocking, not broader visual redesign of the exercise flow

## Validation Plan

- run `npm --prefix renderer test -- --run`
- verify that an open confirmation dialog renders with overlay/backdrop styles that place it above the screen content and visually separate the background
- confirm that click paths for underlying exercise controls are blocked or ignored while the dialog is open and that only dialog actions remain interactive until dismissal or confirmation

## Out of Scope

- workout-screen mobile polish outside the modal behavior
- adding new dialog types or a broader UI redesign beyond the shared blocking-modal treatment
- backend or persistence changes

## Handoff Notes for Implementation

- keep the implementation within the existing renderer stack of Web Components, CSS, and Vitest-based tests
- prefer a shared overlay treatment that can be reused by future dialogs without expanding the item scope
- preserve current dialog copy and confirmation flow semantics while changing presentation and interaction blocking
