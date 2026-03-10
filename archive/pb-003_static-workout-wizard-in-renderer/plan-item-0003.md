# Plan: Weight Input and Step-Level Adjustment Controls

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Add a numeric weight field to each exercise step with adjacent decrement/increment controls, distinct default suggestions per exercise, and step-to-step persistence of edited values across wizard navigation.

## Implementation Approach

- Extend the step-level exercise state model to include a numeric `weight` value per exercise, seeded from five distinct defaults.
- Render numeric-only weight input and adjacent decrement/increment buttons in the exercise step UI, wired to the same step-local state update path.
- Implement guarded input parsing so only valid numeric updates are accepted, while invalid/non-numeric characters are rejected without corrupting state.
- Ensure wizard previous/next navigation uses persistent in-memory step state so edited weights remain visible when returning to prior steps.

## Risks and Assumptions

- Assumes item `0002` already provides stable step navigation/state plumbing that can be extended without architectural changes.
- Input behavior can vary by browser for `type="number"`, so explicit validation/parsing logic may still be needed in handlers.

## Validation Plan

- Run focused frontend tests for step state and input/control handlers (add/update tests where behavior is non-trivial).
- Manually verify each exercise starts with a distinct default value and that increment/decrement and direct input keep values synchronized.
- Manually verify moving previous/next across steps preserves edited weights when revisiting steps.
- Run `cd renderer && npm run build` to satisfy the item’s acceptance gate.

## Out of Scope

- Changing wizard flow structure or introducing new exercise steps.
- Backend/API persistence of selected weights beyond current wizard session behavior.
- Broader styling redesign beyond placing controls adjacent to the input.

## Handoff Notes for Implementation

- Keep implementation aligned with existing Web Components + TypeScript patterns in the renderer.
- Favor small, explicit state update helpers to keep numeric validation predictable and testable.
- Avoid introducing new frameworks or major dependencies for input handling.
