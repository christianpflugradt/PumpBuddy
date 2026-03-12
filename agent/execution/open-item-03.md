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
