# Plan: Enforce Backend Unit Test Isolation from Real DB

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Ensure backend unit/module persistence tests run as isolated logic tests without requiring a live PostgreSQL database, preserving meaningful logic and edge-case validation.

## Implementation Approach

- Audit `backend/src` for unit/module tests that currently perform DB bootstrap (start with `backend/src/persistence/tests.rs`).
- Introduce or prefer a lightweight seam for persistence logic (trait or interface) so tests can inject a mock/fake implementation.
- Replace DB-backed setup in unit/module tests with fake in-memory implementations or mocked dependencies that exercise mapping and business logic.
- Keep any DB bootstrap only in integration tests (e.g., `tests/` integration folder) and ensure unit tests never call real DB connection code.

## Risks and Assumptions

- Assumes persistence layer has separable interfaces or can be refactored minimally to support injection of fakes/mocks.
- Risk: some tests may implicitly rely on DB behavior; those should be evaluated and either converted to integration tests or rewritten to assert only logic-level behavior.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml --lib` and confirm unit/module tests complete without attempting DB connections.
- Verify `backend/src/persistence/tests.rs` and other unit test files no longer contain DB bootstrap code or direct `tokio_postgres`/`sqlx` connection setup.

## Out of Scope

- Adding new product features or reducing integration test coverage that validates real DB interactions.

## Handoff Notes for Implementation

- Prefer small incremental commits per module to keep reviews focused.
- Where necessary, add short comments in converted tests explaining why a test became a fake/mocked unit test vs an integration test.
