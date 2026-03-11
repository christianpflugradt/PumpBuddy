# Plan: Add Targeted Persistence and Initialization Tests

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Add focused backend integration tests for pb-004 that validate schema initialization/seed invariants from `backend/init.sql` and representative SQLx workout persistence read/write behavior.

## Implementation Approach

- Add a shared integration-test harness that provisions PostgreSQL for tests and applies `backend/init.sql` deterministically.
- Add seed invariant tests that assert required baseline counts (gyms, plans, and per-plan exercise totals) and validate variant-option differences expected by pb-004.
- Add one representative persistence write-path test for workout/set data and one representative read-path test that verifies persisted workout state can be queried correctly.
- Keep assertions contract-focused and stable (schema + persistence behavior), avoiding broad API endpoint simulation.
- Ensure tests run with existing backend test tooling (`cargo test`) and containerized runtime flow (`docker compose ... cargo test`).

## Risks and Assumptions

- Assumes existing SQLx query layer and testcontainers-based setup can be reused or extended without introducing new major dependencies.
- Seed invariant assertions may be brittle if seed data intentionally evolves; tests should target explicit pb-004 invariants only.
- Integration test runtime may increase; keep coverage narrowly scoped to high-value checks.

## Validation Plan

- Run: `cd backend && cargo test`
- Run: `docker compose up --build -d && docker compose exec -T backend cargo test && docker compose down`
- Confirm failing behavior by temporarily altering one known seed invariant locally and verifying corresponding integration test failure (then restore).

## Out of Scope

- Frontend workflow or E2E coverage changes.
- Performance/load testing.
- Adding broad endpoint-level integration suites unrelated to pb-004 persistence invariants.

## Handoff Notes for Implementation

- Preserve contract-first and SQLx-first constraints from project guardrails; do not introduce ORM-style abstractions.
- Keep test data/setup deterministic and isolated so failures clearly indicate seed/schema or persistence regressions.
- If shared test helpers are introduced, keep them lightweight and backend-local to avoid cross-layer coupling.
