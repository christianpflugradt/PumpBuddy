# Plan: Submit Completed Workout From Renderer

## Item Reference

- `agent/execution/open-item-0006.md`

## Goal Summary

Post the completed workout from the renderer to the backend, wait for API success before showing the success state, and add focused automated coverage for the persistence path and renderer completion flow.

## Implementation Approach

- Trace the existing renderer completion flow and identify where selected plan, selected gym, and edited weights are available so the final workout payload can be assembled without expanding client-side scope.
- Update the renderer completion path to call the workout creation API on the last exercise, keep the UI in a pending state during submission, and render the success view only after a successful response.
- Add a minimal failure state for save errors that keeps the user out of the success path and makes the failed submission visible.
- Add or update backend tests around workout creation persistence to verify inserts into `workouts`, `workout_exercises`, and `workout_sets`.
- Add or update renderer tests to cover the happy path submission and the success-state gating on API completion.

## Risks and Assumptions

- The renderer may already hold workout progress in a shape that differs from the API contract, so a small mapping layer may be needed at submission time.
- Existing item dependencies are assumed to have already established the workout creation API contract and the renderer workflow needed to reach the final exercise.
- Test coverage should stay narrow to this slice; broader UI state refactors or generalized error handling are out of scope.

## Validation Plan

- Run `cd backend && cargo test create_workout`.
- Run `cd renderer && npm test`.
- Verify manually, if needed during implementation, that the last exercise no longer transitions directly to success before the API response resolves.

## Out of Scope

- Expanding the workout domain model beyond the fields already needed for the create-workout request.
- Adding richer retry, recovery, or offline submission behavior beyond the minimal error state required by the item.
- Broader renderer UX redesign outside the completion and failure states for this submission flow.

## Handoff Notes for Implementation

- Keep the implementation aligned with the canonical OpenAPI contract and avoid introducing renderer-only API semantics.
- Prefer minimal state additions in the renderer; use the existing flow and data sources where possible.
- Keep backend and renderer test additions focused on the end-to-end persistence slice described in the item.
