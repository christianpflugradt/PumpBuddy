# Plan: Cancel Unfinished Active Workouts

## Item Reference

- `agent/execution/open-item-0006.md`

## Goal Summary

Add a cancellation path for unfinished persisted workouts so the backend removes the workout data and the renderer returns the user to the start screen after an English confirmation step.

## Implementation Approach

- Inspect the existing workout lifecycle in the backend and identify the persisted entities that must be removed together when cancelling an unfinished workout.
- Add a backend cancellation endpoint or handler aligned with the current API contract and persistence layer, returning a response the renderer can use to reset to the start state.
- Enforce backend guards so cancellation only succeeds for workouts that have been persisted but not completed.
- Add a renderer cancellation control only in the unfinished persisted state, show an English confirmation prompt, and reset local UI state after successful cancellation.
- Update backend and renderer tests to cover availability rules, confirmation behavior, successful deletion, and rejection for unsupported states.

## Risks and Assumptions

- The persistence model may span multiple related tables, so deletion should be implemented as a single bounded operation to avoid partial cleanup.
- The current renderer state machine may not cleanly distinguish pre-persistence, active persisted, and completed states; that state mapping may need tightening to gate the action correctly.
- If the API contract does not already define cancellation, the implementation will need a minimal contract update that remains consistent with the existing workout flow.

## Validation Plan

- Run `cargo test` in `/Users/cpf/Workspace/personal/PumpBuddy/backend`.
- Run `npm test` in `/Users/cpf/Workspace/personal/PumpBuddy/renderer`.
- Manually verify the renderer only exposes cancellation for unfinished persisted workouts and returns to the start screen after confirmation.

## Out of Scope

- Cancelling completed workouts.
- Adding a general workout-history deletion capability.

## Handoff Notes for Implementation

- Keep user-facing confirmation copy in English.
- Prefer explicit backend validation and persistence cleanup over renderer-only gating.
- Preserve the existing technology boundaries: Rust/Axum/SQLx in the backend and Web Components in the renderer.
