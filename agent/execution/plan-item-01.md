# Plan: Enforce Active Workout Write Ownership

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Ensure active-workout update and completion mutations are ownership-constrained at the SQL level so that a foreign `workout_id` cannot be used to modify another user's workout.

## Implementation Approach

- Update persistence layer: modify functions in `backend/src/persistence/active_workouts.rs` so all write/update/delete queries include `workout_id = $1 AND user_id = $2` (or equivalent named/parameterized predicate) rather than relying on `workout_id` alone.
- Ensure API/handler flow: in `backend/src/api/handlers.rs` (or the mutation handler location) propagate the authenticated `user_id` into persistence calls; use a single ownership-constrained parent write call inside the same transaction before any child-row mutations.
- Transaction ordering: wrap parent active-workout update/complete and subsequent child-row steps in one transaction so child operations only run after the ownership-constrained parent write returns a row (use returned row count or `RETURNING` to gate follow-up steps).
- Tests: add integration/unit tests under `backend` that attempt cross-user update/complete paths and assert not-found semantics (no state change). Also verify same-user update/complete paths still succeed.

## Risks and Assumptions

- Assumes `user_id` is available from the authenticated request context at the handler layer and is passed down to persistence functions.
- Database schema already contains `user_id` on the relevant tables; if not, schema updates are out of scope for this item.
- Careful with existing SQL helpers: ensure helper functions that previously assumed `workout_id` semantics are updated consistently.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml` to verify unit and integration tests pass.
- Add a focused test that performs: create workout for user A, attempt update/complete using workout_id but authenticating as user B, assert API returns 404/not-found and workout state unchanged.
- Run same-user tests to confirm behavior unchanged.

## Out of Scope

- Changing public API shapes or adding new endpoints.
- Broad authentication or schema redesign.

## Handoff Notes for Implementation

- Primary files to edit:
  - `backend/src/persistence/active_workouts.rs` — change SQL predicates for write/update/complete queries to include `user_id`.
  - `backend/src/api/handlers.rs` (or specific mutation handlers) — ensure `user_id` is passed to persistence layer and that transaction boundaries are correct.
  - `backend/tests` or `backend/src` integration tests — add cross-user negative tests and same-user positive tests.
- Implementation tip: prefer `RETURNING id` (or `RETURNING *`) on the ownership-constrained parent write and check that a row was returned before executing child-row mutations; treat zero rows returned as not-found.
  - Keep NOT FOUND semantics at the handler boundary (map zero-return to 404) and avoid leaking authorization errors.

(Keep plan concise; implementers should not change item acceptance criteria.)
