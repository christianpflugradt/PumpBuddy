# Plan: Consolidate DB Integration Coverage in Backend Integration Tests

## Item Reference

- `agent/execution/open-item-07.md`

## Goal Summary

Ensure that live PostgreSQL persistence behaviour is asserted only from the backend integration test suite and that unit/module tests no longer duplicate DB-backed scenarios.

## Implementation Approach

- Identify DB-backed tests currently in `backend/src/persistence/tests.rs` and other unit/module test files.
- Move integration-worthy scenarios into `backend/tests/persistence_integration.rs`, keeping test names and assertions clear.
- Replace removed unit tests with lightweight unit-level assertions that use mocks or in-memory alternatives (no live DB access).
- Keep critical happy paths and a small set of high-value edge cases in the integration suite; remove duplicate coverage from unit/module tests.
- Update test setup/teardown helpers so the integration suite owns lifecycle of the test database (shared harness in `backend/tests/common` or re-use existing helpers).
- Update CI/test invocation docs and pipelines to run `cargo test --manifest-path backend/Cargo.toml --test persistence_integration` as the authoritative persistence check.

## Risks and Assumptions

- Assumes existing integration harness correctly provisions a PostgreSQL instance for `persistence_integration` tests.
- Risk: subtle behaviour relied on by unit tests may be lost if not migrated; mitigate by auditing removed tests and converting essential assertions to integration scenarios.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml --test persistence_integration` locally and in CI to validate persistence behaviour.
- Run full unit test suite to ensure no tests open network/DB connections (grep for postgres usage or test annotations).
- Confirm CI artifacts and test timings remain acceptable after migration.

## Out of Scope

- Broad E2E test rollout or changing persistence semantics.

## Handoff Notes for Implementation

- When moving tests, preserve test names and fixtures to make review easier.
- If a removed unit test reveals missing behaviour, add a minimal unit-level assertion (mocked) and an integration test for the full flow.
