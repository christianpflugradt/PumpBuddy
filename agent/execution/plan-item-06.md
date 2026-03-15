# Plan: Add user ownership columns and scoping

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Add `user_id` ownership columns to existing domain tables and ensure backend persistence and handlers scope all reads/writes to the authenticated user from session context.

## Implementation Approach

- Review `AUTH_CONCEPT.md` and current session handling to identify the canonical user identifier and where it is attached to request context.
- Add SQL migrations to introduce `user_id` columns and foreign keys on each existing domain table, including backfill or defaulting strategy that preserves existing data.
- Update SQLx queries in persistence modules to include `user_id` in inserts and to filter by `user_id` on reads/updates/deletes.
- Update handlers/services to ignore any client-provided ownership fields and derive `user_id` solely from authenticated session context.
- Add or adjust integration tests for persistence scoping (PostgreSQL-backed) and unit tests for any new ownership logic.

## Risks and Assumptions

- Assumes there is a stable session-derived user identifier defined in `AUTH_CONCEPT.md` that can be accessed in handlers.
- Migrations may require a safe default/backfill for existing rows; verify the expected existing data set before enforcing NOT NULL.

## Validation Plan

- `cargo test --manifest-path backend/Cargo.toml`
- Run any existing database migration or verification script used in CI/local setup (as documented).

## Out of Scope

- Redesigning authentication or user management flows beyond adding ownership scoping.
- Frontend UX changes beyond removing/ignoring any ownership fields in requests.

## Handoff Notes for Implementation

- Keep `backend/src/main.rs` and renderer entrypoints thin; place ownership logic in dedicated modules per guardrails.
- Prefer explicit SQL in SQLx; do not introduce ORM or new heavy dependencies.
