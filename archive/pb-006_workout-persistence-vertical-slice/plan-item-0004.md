# Plan: Add Workout Completion API Handler

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Add the backend `POST /api/workouts` endpoint so completed workouts can be created over HTTP using the existing repository write path and returned in a stable API shape.

## Implementation Approach

- add request DTOs for workout creation in `backend/src/main.rs`, including nested exercise and set payloads aligned with the current OpenAPI contract
- extend `ApiError` and the new handler flow to distinguish request validation failures from repository/internal failures without exposing raw database errors
- wire `POST /api/workouts` into the Axum router, map the request into `domain::NewWorkout`, delegate persistence to `DomainRepository::create_workout`, and return a `201` response body shaped like the workout summary contract
- add focused `workout_api` tests for successful creation and rejected invalid payloads, reusing existing backend test patterns where possible

## Risks and Assumptions

- repository writes already exist, so the main risk is route-level validation being too weak and allowing inconsistent nested exercise or set payloads through to the database layer
- the OpenAPI contract currently documents `400` and `500`; if missing related records surface as database errors, implementation should map only clearly validated client failures to `400` and keep ambiguous cases bounded as internal failures unless the route can pre-validate them safely
- response mapping may need a small helper to convert the created `Workout` into the stable summary response without duplicating fetch logic across handlers

## Validation Plan

- run `cd backend && cargo test workout_api`
- if route tests need integration backing, confirm the success case persists a workout through the handler and that invalid payloads return `400` with the expected error envelope

## Out of Scope

- changing the OpenAPI contract or expanding workout creation beyond the current minimal completed-workout payload
- moving persistence logic out of the repository layer or redesigning the existing workout domain model
- renderer-side integration work beyond what this API contract already requires

## Handoff Notes for Implementation

- keep database access in `backend/src/persistence.rs`; the route should only validate, map DTOs, and call the repository
- preserve actionable but generic API errors at the HTTP boundary, consistent with the existing `ErrorResponse` pattern
- follow the existing backend style in `backend/src/main.rs` instead of introducing a broader handler abstraction unless it is needed to keep the new route testable
