# Plan: Database-backed backend tests can pass without exercising PostgreSQL

## Item Reference

- Stable item id: `item-14`

## Goal Summary

Ensure backend tests that are meant to exercise PostgreSQL either run against a real database runtime or fail with an actionable message, so a green backend test run reliably means the persistence paths were covered.

## Implementation Approach

- Define one deterministic policy in the shared backend test support for missing PostgreSQL runtime, replacing the current `None`/early-return path with a hard failure or explicit required-runtime helper.
- Update database-dependent integration tests in `backend/tests/*` to use the shared policy instead of bare `return`, so API and persistence coverage behaves consistently.
- Apply the same policy to backend application and persistence tests under `backend/src/` that currently gate coverage on optional database setup, while keeping pure unit tests database-free.

## Risks and Assumptions

- The current test harness may be shared across tests with different setup needs, so tightening failure behavior must not accidentally pull pure unit tests into PostgreSQL requirements.
- CI and local runs need a clear failure message when Docker or an external database is unavailable; otherwise the change improves strictness but hurts diagnosability.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml` in an environment with PostgreSQL test runtime available and confirm the database-backed tests execute successfully.
- Verify the unavailable-runtime path now fails loudly with actionable guidance instead of reporting success through skipped execution.

## Out of Scope

- Expanding test coverage beyond the database-dependent paths already identified in the item.
- Changing item scope or acceptance criteria for unrelated backend test architecture.

## Handoff Notes for Implementation

- Keep the implementation aligned with the repository test strategy: meaningful PostgreSQL-backed integration coverage should remain real, not simulated.
- Prefer a small shared test helper change over repeated per-test logic so the policy stays consistent across `backend/src/` and `backend/tests/`.
