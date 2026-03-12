# Plan: Add focused backend tests for durable logic

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Close a meaningful backend coverage gap with focused tests around persistence behavior that is likely to remain stable and materially affects branch coverage.

## Implementation Approach

- inspect `backend/src/persistence.rs` against the current integration suite to identify durable uncovered branches instead of adding metric-padding assertions
- prioritize tests for active-workout error paths and read-model invariants, especially conflict and not-found outcomes in `create_active_workout`, `update_active_workout`, `complete_active_workout`, and `cancel_active_workout`
- add or expand backend integration tests in `backend/tests/persistence_integration.rs`, reusing the existing seeded PostgreSQL setup and keeping scenarios narrow
- only add unit tests if a durable branch is easier to verify outside the database boundary; otherwise prefer repository-level integration coverage

## Risks and Assumptions

- branch coverage improvement depends on choosing paths that are currently uncovered by `agent/scripts/check-backend-coverage.sh`, so the implementation should confirm the baseline before adding tests
- integration coverage still depends on a Docker-capable environment or an explicit `TEST_DATABASE_URL`
- tests should avoid locking in incidental SQL ordering or temporary renderer placeholders beyond behavior the item already treats as durable

## Validation Plan

- run `cargo test --manifest-path backend/Cargo.toml`
- run `agent/scripts/check-backend-coverage.sh` and confirm a measurable backend branch coverage improvement or threshold compliance

## Out of Scope

- renderer or end-to-end test expansion
- behavior changes to backend production code unless a test uncovers a real defect that must be fixed to satisfy the item

## Handoff Notes for Implementation

- prefer extending the existing persistence integration file over introducing a parallel test harness
- keep new assertions centered on durable outcomes: returned domain objects, persisted records, and explicit `PersistenceError` variants
