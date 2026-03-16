# Extended Review Findings

Review Task: review-architecture

Summary:

- 3 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Cross-user write path in active workout replacement bypasses ownership boundary
Priority: P0

## Summary

The active-workout update path does not enforce user ownership in its write query, allowing a caller with a different user's workout ID to mutate workout state across tenants. This breaks the core trust boundary that workout data is user-scoped at the backend persistence boundary.

## Evidence

- `backend/src/persistence/active_workouts.rs` `replace_active_workout` updates `workouts` with `WHERE id = $1::uuid AND completed_at IS NULL` and does not include `user_id` filtering.
- The same function then deletes and rewrites child workout progress rows by `workout_id` alone.
- The function signature includes `user_id`, but that value is not applied to the update/delete ownership checks in this path.

## Goal

Enforce user ownership on all active-workout write operations so cross-user mutation is impossible even if a foreign workout ID is supplied.

## Implementation Direction (Agreed)

Adopt query-level ownership enforcement (Option A): every active-workout mutation must be constrained by both `workout_id` and authenticated `user_id` in the write SQL itself.

## Scope

- require `user_id` predicates on all active-workout mutation queries in `replace_active_workout` (no write path by `workout_id` alone)
- ensure child-row deletes/inserts are only executed after the parent workout write confirms ownership for the same authenticated user
- use a single ownership-constrained write path (avoid separate pre-check + write sequences for authorization)
- preserve existing API behavior for legitimate same-user updates and completion flows

## Acceptance Criteria

- update and completion writes fail with not-found semantics when `workout_id` does not belong to the authenticated user
- active-workout mutation SQL includes explicit `workout_id + user_id` ownership constraints on all write operations in this flow
- no mutation in this flow is authorized by a standalone ownership pre-check without matching constraints in the write statement
- backend tests cover cross-user mutation attempts for update and complete flows

## References

- `backend/src/persistence/active_workouts.rs`
- `backend/src/api/handlers.rs`
<!-- END FINDING -->

<!-- FINDING -->
# Renderer workout controller violates intended layering and single-responsibility boundaries
Priority: P1

## Summary

The renderer orchestration file has grown into a monolithic control surface that mixes view orchestration, network persistence flow, mutation-heavy state transitions, input normalization, and DOM event wiring. This is architectural drift from the intended separation between presentation, orchestration, state handling, and API/client concerns.

## Evidence

- `renderer/src/workout-controller.ts` is a large, single module handling initialization, fetch/bootstrap, save/retry logic, navigation guards, confirm dialog lifecycle, and all DOM event routing.
- The file directly coordinates backend API calls while also mutating exercise draft state and managing rendering cadence.
- The repository guardrails require splitting renderer files once they become the default landing place for unrelated UI and workflow responsibilities.

## Goal

Restore renderer layering by splitting workout orchestration into focused modules with clear ownership for workflow, event handling, and persistence coordination.

## Implementation Direction (Agreed)

Adopt a three-way split (Option A): separate workout workflow orchestration, UI event routing, and persistence coordination into distinct modules with explicit interfaces; keep bootstrap/entry wiring thin.

## Scope

- extract workflow orchestration from `renderer/src/workout-controller.ts` into a dedicated module responsible for start/save/resume/complete/cancel transitions
- extract UI event routing and DOM listener registration into a dedicated interaction module
- extract persistence coordination (API calls, retry/save flow coordination) into a dedicated persistence module
- keep rendering functions in presentation modules and state transitions in state-focused modules
- keep the app entry/bootstrap path thin and limited to composition and wiring

## Acceptance Criteria

- `renderer/src/workout-controller.ts` no longer contains the full end-to-end workflow orchestration and event matrix in one file
- persistence flow, UI event routing, and workflow orchestration are represented in separate modules with explicit interfaces
- app bootstrap only composes modules and does not re-accumulate business workflow logic
- existing workout start, save, resume, complete, and cancel behavior remains unchanged

## References

- `renderer/src/workout-controller.ts`
- `renderer/src/workout-state.ts`
- `renderer/src/workout-render.ts`
- `agent/strategy/engineering-guardrails.md`
<!-- END FINDING -->

<!-- FINDING -->
# API layer concentrates router assembly, request handlers, and endpoint tests in one module
Priority: P2

## Summary

The backend API module combines route registration, many endpoint handlers, and route-level tests in the same file, which increases coupling between transport wiring and feature behavior. This reduces boundary clarity and makes architecture-sensitive changes riskier over time.

## Evidence

- `backend/src/api/handlers.rs` contains full router wiring plus all workout and plan handlers.
- The same file also includes a substantial `#[cfg(test)]` module with endpoint smoke tests.
- Guardrails call for keeping entry/wiring surfaces thin and splitting modules when they accumulate unrelated responsibilities.

## Goal

Separate backend transport wiring from endpoint implementation and test concerns so API boundary modules remain small and composable.

## Implementation Direction (Agreed)

Adopt feature-oriented modularization (Option A): keep router assembly thin and focused on composition, move handler implementations into feature modules, and colocate tests with feature modules where practical.

## Scope

- keep top-level router assembly focused on route/middleware composition only
- move endpoint handler implementations from `backend/src/api/handlers.rs` into feature-focused modules
- move endpoint tests out of the router/wiring module and colocate with feature handler modules where practical
- preserve current API contract behavior and middleware enforcement

## Acceptance Criteria

- router composition module is primarily route/middleware wiring, not bulk handler logic
- handler logic is split into dedicated feature modules with clear boundaries
- route-level tests are no longer concentrated in the router composition module
- route-level and feature-level tests remain passing after the split

## References

- `backend/src/api/handlers.rs`
- `backend/src/api/mod.rs`
- `agent/strategy/engineering-guardrails.md`
<!-- END FINDING -->
