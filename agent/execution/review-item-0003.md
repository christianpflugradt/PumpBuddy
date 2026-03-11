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
- `cargo test` succeeds in `/Users/cpf/Workspace/personal/PumpBuddy/backend`

## References

- `agent/strategy/plan.md`
- `agent/design/api-contract.yaml`
- `agent/design/domain-model.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/src/domain.rs`
- `backend/init.sql`

## Dependencies

- `item-0002`

## Out of Scope

- renderer-side workflow changes
- workout cancellation behavior
