# Plan: Backend application layer depends on API transport errors

## Item Reference

- `agent/execution/open-item-10.md`

## Goal Summary

Decouple workout validation in the backend application layer from HTTP transport errors so the API layer becomes the only place that maps failures to response status codes and messages.

## Implementation Approach

- Add an application-local workout validation error type in `backend/src/application/` that represents validation failures and persistence-backed lookup failures without importing `api` symbols.
- Update `backend/src/application/workouts.rs` validation functions to return the application error type and translate repository failures into application-level results.
- Adjust `backend/src/api/handlers.rs` to map application validation outcomes into `ApiError` while leaving persistence-to-HTTP translation at the API boundary.
- Update or extend tests so application tests assert the new application error type and API-facing tests continue to protect the HTTP error contract where behavior is non-trivial.

## Risks and Assumptions

- The application error shape should stay small and specific to this validation flow rather than becoming a second transport-oriented error hierarchy.
- Existing validation messages appear user-facing; preserving them avoids accidental API behavior changes while the dependency direction is corrected.
- If repository failures need richer distinction than currently exposed, that should still be represented in application terms and only converted to `ApiError` in the API layer.

## Validation Plan

- Run backend tests covering `application::workouts` and any affected API error mapping.
- Verify no file under `backend/src/application/` imports from `backend/src/api/`.
- Confirm create/update/complete workout handlers still return the same HTTP status codes and validation messages for current failure cases.

## Out of Scope

- Changing item scope, acceptance criteria, or public API payload formats.
- Refactoring unrelated handler or repository code outside the validation/error boundary needed for this item.

## Handoff Notes for Implementation

- Keep `backend/src/main.rs` and router wiring thin; place new error types in dedicated application modules if `workouts.rs` starts accumulating mixed responsibilities.
- Prefer minimal changes to existing validation call sites so the dependency inversion is clear and easy to review.
