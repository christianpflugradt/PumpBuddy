# Plan: Stabilize Backend Postgres Tests In CI

## Item Reference

- `agent/execution/open-item-22.md`

## Goal Summary

Ensure CI backend tests have a reachable Postgres instance and wait for readiness without timeouts, with required env vars documented.

## Implementation Approach

- Inspect `.github/workflows/ci-quality.yml` to confirm a Postgres service (or Testcontainers-compatible setup) is provisioned for backend tests.
- Align backend test configuration/timeouts (e.g., in `backend/src/persistence/tests.rs` or test helpers) to wait for Postgres readiness instead of failing early.
- Document required CI environment variables (such as `DATABASE_URL`) in the workflow or related docs/comments.

## Risks and Assumptions

- Assumes CI environment can run a Postgres service or Docker-in-Docker for Testcontainers without additional permissions.
- Changes to readiness waiting may increase test runtime; keep timeouts bounded.

## Validation Plan

- Re-run backend test step in CI workflow (or locally via the same command) to confirm no connection timeouts.
- Confirm repeated runs do not hang on Postgres readiness.

## Out of Scope

- Refactoring backend persistence logic unrelated to test setup.
- Adding new test suites beyond what is needed for CI stability.

## Handoff Notes for Implementation

- Prefer minimal, explicit changes to CI workflow and test setup; avoid new dependencies unless required.
