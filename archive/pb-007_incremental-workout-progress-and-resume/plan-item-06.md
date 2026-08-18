# Plan: Cancel Unfinished Active Workouts

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Add a cancellation path for unfinished persisted workouts so the backend removes the workout data and the renderer returns the user to the start screen after an English confirmation step.

## Implementation Approach

- Extend the existing `DELETE /api/active-workout/{workoutId}` contract path in `backend/src/main.rs` and route it to a repository cancellation operation instead of adding a new workflow shape.
- Implement repository cleanup in `backend/src/persistence.rs` as one bounded deletion path that removes the active workout record and its related persisted exercise or set data together.
- Reuse the current active-workout state validation so cancellation only succeeds for persisted-but-incomplete workouts and rejects missing or already-completed records with the documented API errors.
- Add a renderer API method and UI action in `renderer/src/app.ts`, gated by `activeWorkout.id` plus `persistedExerciseCount > 0`, so cancellation is hidden before the first persisted confirmation and after completion resets state.
- Use an English `window.confirm` message that explicitly says the unfinished workout data will be deleted, then on success clear local workout state and return the app to the start screen.
- Cover the change with backend request or repository tests for delete success and invalid states, plus renderer tests for button visibility, confirmation copy, and state reset after a successful cancellation.

## Risks and Assumptions

- Active workout persistence spans multiple rows, so cancellation should run as a single cleanup unit to avoid orphaned records.
- The renderer currently tracks persisted progress via `persistedExerciseCount`; the cancellation gate should rely on that existing distinction instead of introducing a parallel state flag unless implementation proves it insufficient.
- The API contract already reserves the delete operation, so implementation should stay within that contract unless a concrete mismatch is discovered.

## Validation Plan

- Run `cargo test` in `backend`.
- Run `npm test` in `renderer`.
- Manually verify the renderer only exposes cancellation for unfinished persisted workouts, shows English confirmation copy, and returns to the start screen after deletion.

## Out of Scope

- Cancelling completed workouts.
- Adding a general workout-history deletion capability.

## Handoff Notes for Implementation

- Keep user-facing confirmation copy in English.
- Prefer explicit backend validation and persistence cleanup over renderer-only gating.
- Preserve the existing technology boundaries: Rust/Axum/SQLx in the backend and Web Components in the renderer.
