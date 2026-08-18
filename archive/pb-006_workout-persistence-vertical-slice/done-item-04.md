# Add Workout Completion API Handler

## Goal

Expose the completed-workout write path through the backend API so the renderer can create workouts through HTTP instead of local-only state transitions.

## Scope

- add request and response DTOs for workout creation in `backend/src/main.rs`
- implement an Axum `POST /api/workouts` handler that validates the minimal payload and calls the repository write path
- return a stable success response that the renderer can use for the completion state
- map validation, not-found, and internal failures into actionable API responses without leaking internal details

## Acceptance Criteria

- the backend router exposes `POST /api/workouts`
- the handler delegates persistence to the repository layer rather than embedding database logic in the route
- invalid or inconsistent input is rejected with an API error response instead of partial writes
- executable verification: `cd backend && cargo test workout_api`

## References

- `agent/strategy/plan.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/security-baseline.md`
- `agent/design/api-contract.yaml`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`

## Dependencies

- `item-01`
- `item-03`




## Review Findings

### Criterion

invalid or inconsistent input is rejected with an API error response instead of partial writes

- Status: fail
- Evidence: [`backend/src/main.rs:389`](backend/src/main.rs#L389) accepts `reps == 0` because it only rejects values `< 0` and emits the message "set.reps must be zero or greater". The canonical contract also advertises `reps` with `minimum: 0` in [`agent/design/api-contract.yaml:227`](agent/design/api-contract.yaml#L227). But persistence writes that value into `workout_sets.reps`, where the schema enforces `reps IS NULL OR reps > 0` in [`backend/init.sql:165`](backend/init.sql#L165). That database check violation is not mapped as validation in [`backend/src/main.rs:459`](backend/src/main.rs#L459), so a `reps: 0` request falls through as an internal error instead of a clean actionable client error. The previously reported cross-plan mismatch issue is fixed by [`backend/src/main.rs:437`](backend/src/main.rs#L437) and covered by [`backend/src/main.rs:644`](backend/src/main.rs#L644). The required verification command `cd backend && cargo test workout_api` passed with 3 tests passing.
- Risk: A payload shape the API currently documents and locally validates can still fail only at the database boundary, producing a misleading 500-class failure for user input. That breaks the item's validation/error-mapping goal and leaves renderer-side error handling unable to distinguish bad input from backend failure.


## Review Acceptance

- Criteria Met: `POST /api/workouts` is exposed in the Axum router, request validation is performed in `CreateWorkoutRequest::validate_and_into_domain`, the handler delegates writes to `DomainRepository::create_workout`, and invalid payloads including cross-plan exercises and `reps: 0` are rejected with API errors before any write.
- Evidence: [`backend/src/main.rs`](backend/src/main.rs) defines the create-workout DTOs, registers `post(create_workout)` on `/api/workouts`, validates payload invariants including positive exercise positions and `reps > 0` when provided, and maps persistence failures to bounded API responses. [`backend/src/persistence.rs`](backend/src/persistence.rs) contains the transactional repository write path, keeping SQL out of the route handler.
- Runtime/Build Check: Executed `cd backend && cargo test workout_api`; observed result: 4 tests passed, 0 failed.
- Residual Risk: None identified for this item's stated scope.
