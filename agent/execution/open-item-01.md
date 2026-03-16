# Enforce Active Workout Write Ownership

## Goal

Ensure active-workout update and completion mutations are ownership-constrained in SQL so foreign `workout_id` values cannot be used for cross-user writes.

## Scope

- apply `workout_id + user_id` ownership predicates to active-workout write queries in the backend mutation flow
- ensure child-row mutation steps execute only after an ownership-constrained parent write succeeds
- preserve current same-user update and completion behavior
- add backend tests for cross-user update and complete mutation attempts with not-found semantics

## Acceptance Criteria

- active-workout write SQL in the mutation flow uses explicit `workout_id` and `user_id` predicates
- cross-user mutation attempts for update and complete paths return not-found behavior without modifying workout state
- same-user update and complete paths still succeed with existing expected behavior
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/persistence/active_workouts.rs`
- `backend/src/api/handlers.rs`
- `agent/strategy/security.md`

## Out of Scope

- introducing new public endpoints or changing API contract shapes
- broader authentication model redesign
