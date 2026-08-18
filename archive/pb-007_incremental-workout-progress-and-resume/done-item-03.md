# Implement Backend Active Workout Persistence

## Goal

Implement backend persistence and API handling for incremental active workout creation, update, lookup, and completion.

## Scope

- add or update backend persistence logic so the first confirmed exercise creates a persisted workout and later confirmations update it
- implement backend read logic that returns the first unfinished active workout for automatic resume
- mark the workout as completed on the final confirmation so it no longer appears as active
- cover the persistence behavior with backend tests at the appropriate level

## Acceptance Criteria

- the backend does not persist an active workout before the first confirmed exercise payload reaches the relevant handler
- after each confirmed exercise, the backend stores enough state to restore the unfinished workout and identify the next remaining step
- the backend returns the first unfinished workout when more than one invalid active workout exists
- completing the final exercise removes the workout from the active-workout lookup path without deleting the completed record
- `cargo test` succeeds in `backend`

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/domain-model.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`
- `backend/init.sql`

## Dependencies

- `item-02`

## Out of Scope

- renderer-side workflow changes
- workout cancellation behavior


## Review Acceptance

- Criteria Met: The backend only persists resumable workout state through the active-workout create/update/complete handlers after a confirmed exercise payload is submitted; persisted state includes confirmed exercises plus derived `current_exercise_position`; active-workout lookup returns the first unfinished workout by `created_at`; completion removes the workout from the active lookup path while preserving the completed workout row.
- Evidence: `backend/src/main.rs` validates active-workout payloads before persistence and routes create/update/complete through dedicated handlers; `backend/src/persistence.rs` implements `create_active_workout`, `update_active_workout`, `complete_active_workout`, `fetch_first_active_workout`, and `fetch_active_workout` with unfinished-workout filtering and first-created selection; `backend/tests/persistence_integration.rs` covers resume, fallback-to-first-active when multiple unfinished workouts exist, and completion behavior; `backend/src/main.rs` includes API round-trip coverage for create, resume, update, and complete.
- Runtime/Build Check: `cargo test` in `backend` passed with all tests succeeding, including `active_workout_persistence_supports_resume_and_completion` and `active_workout_api_round_trips_create_resume_update_and_complete`.
- Residual Risk: none identified
