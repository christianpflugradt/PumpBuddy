# Backend application validation is coupled to HTTP transport errors

## Summary

The backend application layer currently returns transport-layer `ApiError` values directly, which weakens maintainability and makes business validation logic harder to reuse or test independently from the HTTP surface.

## Evidence

- `backend/src/application/workouts.rs:1-5` imports `map_persistence_error` and `ApiError` from `crate::api`.
- `backend/src/application/workouts.rs:7-53` returns `Result<(), ApiError>` from application-level validation functions.
- `backend/src/api/handlers.rs` calls those functions from the HTTP boundary, so application-level code is now defined in terms of HTTP-facing error semantics instead of application-local outcomes.
- `agent/strategy/engineering-guardrails.md` requires clear separation between backend transport, business logic, and persistence layers.

## Goal

Re-establish one-way dependency flow so application validation exposes application-local failures and the API layer remains the only place that translates them into HTTP responses.

## Scope

- introduce an application-local validation or service error type
- move persistence-to-HTTP mapping fully into the API boundary
- preserve current externally visible API behavior while removing the transport dependency from `backend/src/application/`

## Acceptance Criteria

- no file under `backend/src/application/` imports from `backend/src/api/`
- application validation functions return application-local errors rather than `ApiError`
- API handlers remain responsible for mapping application and persistence failures into HTTP status codes and messages

## References

- `backend/src/application/workouts.rs`
- `backend/src/api/handlers.rs`
- `backend/src/api/error.rs`
- `agent/strategy/engineering-guardrails.md`


## Review Acceptance

- Criteria Met: All acceptance criteria are satisfied: application validation no longer imports API modules, validation functions return application-local errors, and API handlers map both validation and persistence failures to HTTP-facing `ApiError` values.
- Evidence: `backend/src/application/workouts.rs` defines and returns `WorkoutValidationError` with `Validation` and `Persistence` variants while only importing domain and persistence modules; `backend/src/api/handlers.rs` maps `WorkoutValidationError` through `map_workout_validation_error` and maps repository failures with `map_persistence_error`.
- Runtime/Build Check: Executed `cargo test map_persistence_error_converts_non_database_errors_to_internal` in `backend/`; result: test passed (`1 passed, 0 failed`).
- Residual Risk: none identified.
