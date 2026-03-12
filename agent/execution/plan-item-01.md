# Plan: Replace Native Workout Confirms With App Modals

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Replace the workout flow's browser-native confirmation dialogs with renderer-managed app modals while preserving the current English confirmation copy and outcomes for cancel, forward navigation, and finish actions.

## Implementation Approach

- Add lightweight confirmation-dialog state to the renderer app so pending confirm actions can be opened, cancelled, and resolved without introducing a framework or modal dependency.
- Render a reusable modal UI from `renderer/src/app.ts` that displays the existing confirmation messages and exposes explicit confirm and dismiss actions that can be disabled while workout saves are in flight.
- Update the cancel, next-exercise, and finish handlers to open the app modal instead of calling `window.confirm`, then execute the existing action logic only after the modal confirm path resolves.
- Extend `renderer/src/app.test.ts` to cover modal-driven confirmation behaviour for the three affected flows and keep the existing helper-level coverage for forward-navigation confirmation decisions.

## Risks and Assumptions

- The renderer currently manages all UI state in a single module, so modal state should stay small and avoid branching that makes render logic hard to follow.
- The confirm messages must remain byte-for-byte consistent with the current English copy to satisfy the item scope.
- Tests will likely need small fake-DOM extensions to trigger modal button actions because there is no browser-native dialog anymore.

## Validation Plan

- Run `npm --prefix renderer test -- --run`.
- Run `rg -n "window\\.confirm\\(" renderer/src` and verify there are no matches.

## Out of Scope

- Broader visual redesign beyond the new confirmation dialog presentation.
- Introducing a frontend framework or third-party modal package.

## Handoff Notes for Implementation

- Keep the modal pattern reusable for future renderer confirmations, but avoid widening scope beyond the three current workout-flow prompts.
- Preserve the existing save-state guards so users cannot trigger duplicate cancel or finish requests while persistence is active.
