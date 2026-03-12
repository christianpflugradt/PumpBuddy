# True Blocking Modals

## Goal

Make dialogs render as true blocking modals across the UI.

## Scope

- implement shared dialog layering, backdrop, and interaction blocking so open dialogs sit above the rest of the interface
- prevent background pointer interaction and visually separate background content while a dialog is open
- add or update renderer tests for the modal behavior that materially changes user-visible interaction

## Acceptance Criteria

- dialogs render above application content with clear visual separation from the background
- background interaction is blocked while a dialog is open, including pointer interaction with underlying controls
- `npm --prefix renderer test -- --run` passes

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`

## Out of Scope

- broader visual redesign beyond the modal behavior itself
- unrelated workout-screen mobile polish


## Review Acceptance

- Criteria Met: All acceptance criteria for true blocking modal behavior are satisfied. The dialog now renders in a dedicated fixed layer above app content, adds a visual backdrop blur/dim treatment, blocks background click actions while open, and `npm --prefix renderer test -- --run` passes.
- Evidence: `renderer/src/app.ts` wraps the confirmation dialog in `.confirm-dialog-layer` with a separate `.confirm-dialog-backdrop`, preserves `aria-modal="true"`, and returns early from non-dialog click handling whenever `state.confirmDialog.message` is present. `renderer/src/styles.css` gives the modal layer fixed full-screen positioning, high z-index, centered layout, and a dimmed blurred backdrop. `renderer/src/app.test.ts` asserts the modal layer/backdrop render and verifies `next-set` does not mutate the exercise state while the dialog is open.
- Runtime/Build Check: Executed `npm --prefix renderer test -- --run` and observed `pass 21`, `fail 0`.
- Residual Risk: none identified
