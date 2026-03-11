# Plan: Implement Backend Active Workout Persistence

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Add backend support for persisting an active workout only after the first confirmed exercise, updating that persisted workout as later confirmations arrive, exposing the first unfinished workout for resume, and marking the final confirmation as completed without deleting workout history.

## Implementation Approach

- Extend the workout domain and persistence layer around the existing `workouts`, `workout_exercises`, and `workout_sets` tables so one code path can create the first persisted active workout and later calls can append or update confirmed exercise progress on the same workout record.
- Add repository read logic for the first unfinished workout ordered deterministically, including enough joined exercise and set data to reconstruct progress and determine the next remaining step.
- Update the Axum workout handlers and request validation so the API supports incremental active-workout create/update/resume behavior while preserving current identifier, timestamp, and training-plan validation rules.
- Reuse the existing `completed_at` field to remove a finished workout from the active lookup path when the final exercise confirmation is stored, while leaving the completed workout readable through existing summary or fetch paths.

## Risks and Assumptions

- The current contract only exposes `POST /api/workouts` and `GET /api/workouts/{workoutId}/summary`, so implementation will likely require contract and handler expansion or a clear reinterpretation of the existing create route for incremental writes.
- Existing persistence helpers assume a full workout payload in one request; refactoring should preserve completed-workout reads and avoid duplicating insert logic across create and update flows.
- "First unfinished workout" needs a stable ordering rule; use database ordering that is explicit and testable rather than relying on implicit row order.

## Validation Plan

- Add backend persistence integration tests covering: no record before first confirmation, first confirmation creates an unfinished workout, later confirmations update the same workout, and final confirmation sets `completed_at` so active lookup no longer returns it.
- Add API-level tests for the active workout write and resume paths, including validation failures for invalid identifiers or mismatched training-plan exercise IDs.
- Run `cargo test` in `backend/`.

## Out of Scope

- Renderer-side orchestration or resume UI changes.
- Workout cancellation semantics.
- Broad schema redesign beyond what is required to support active workout persistence and lookup.

## Handoff Notes for Implementation

- Prefer additive repository methods such as active-workout lookup and incremental write helpers over replacing the existing completed-workout read paths wholesale.
- Keep tests database-backed where persistence behavior matters, consistent with the repository test strategy already used in `backend/tests/persistence_integration.rs`.
