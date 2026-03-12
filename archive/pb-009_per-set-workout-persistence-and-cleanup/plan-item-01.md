# Plan: Add Per-Set Workout Persistence And Suggestions

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Align the active-workout backend flow with the existing per-set domain model so each completed set is persisted as immutable history and the API returns backend-derived defaults for the next set.

## Implementation Approach

- update the active-workout request and response shapes to represent completed exercise sets as a list of historical sets plus a backend-suggested next set
- adjust active-workout persistence and mapping logic so new submissions append a `WorkoutSet` with the next `set_index` instead of replacing prior set data
- derive suggestion values from the most recent completed set in the current exercise, or fall back to the latest historical set for that exercise across prior workouts, then to `10 kg` and `10` reps
- keep renderer-facing history read-only by returning completed sets separately from the editable suggestion payload
- add or update backend tests around persistence, suggestion selection, and the no-history fallback

## Risks and Assumptions

- the active-workout database schema already supports multiple sets per exercise, so the main risk is API and mapping drift rather than a migration gap
- changing the active-workout contract may require coordinated updates in both handler validation and response serialization paths
- suggestion lookup across prior workouts must avoid accidentally reading sets from the in-progress exercise when current-exercise history should take precedence

## Validation Plan

- run targeted backend tests covering active-workout create/update flows and persistence integration scenarios for multi-set exercises
- run `cargo test --manifest-path backend/Cargo.toml`

## Out of Scope

- changing workout scope, acceptance criteria, or progression rules beyond the stated fallback and previous-set reuse
- adding editing support for previously completed sets or broader workout history features
- introducing new persistence technologies or non-SQLx data access patterns

## Handoff Notes for Implementation

- keep the OpenAPI contract as the canonical API source if contract updates are required
- preserve SQLx-based persistence and existing set ordering guarantees via `set_index`
- prefer focused integration coverage where database-backed behavior determines correctness
