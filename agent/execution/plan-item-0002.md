# Plan: Item 0002 - Static Workout Wizard Navigation

## Item Reference

- `agent/execution/open-item-0002.md`

## Goal Summary

Implement a static client-side workout wizard in the renderer that moves through exactly five hardcoded exercises in a single-page flow with previous/next navigation.

## Implementation Approach

- Inspect the current renderer start screen flow and identify where `Start Workout` action should transition to the exercise-step view without reloading the page.
- Define a static in-memory `Push Day` workout object with exactly five realistic English exercise names in renderer state.
- Add wizard state for current exercise index and render only the active exercise at a time.
- Implement `Previous` and `Next` step controls with boundary handling at first and last exercise.
- Ensure navigation updates only renderer state and DOM content, preserving one continuous SPA-like session.

## Risks and Assumptions

- Assumes item `0001` established the baseline renderer structure and start screen action wiring referenced by this task.
- Risk of accidental full-page navigation if existing controls still use link/form defaults; implementation should use explicit client-side event handling.

## Validation Plan

- Manually verify that clicking `Start Workout` enters the first exercise step without a full page reload.
- Verify exactly five exercises exist and only one is visible at a time while navigating.
- Verify backward and forward navigation updates the visible exercise content correctly across boundaries.
- Verify boundary behavior keeps navigation deterministic (first step cannot move backward, last step cannot move forward past step five).
- Run `cd renderer && npm run build` and confirm it exits successfully.

## Out of Scope

- Backend API integration, persistence, or dynamic workout loading.
- Changes to authentication, administrative flows, or multi-workout selection.
- Expanding exercise flow beyond the fixed five-step static `Push Day` plan.

## Handoff Notes for Implementation

- Keep the implementation aligned with Web Components + TypeScript + Vite stack constraints.
- Keep state and rendering logic simple and local to renderer components; avoid introducing heavyweight state libraries.
- Treat this as a static UI flow milestone; avoid inventing new product behavior beyond the item definition.
