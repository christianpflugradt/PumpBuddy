# Plan: Modularize Backend API Router and Handlers

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Separate transport/router composition from feature handler implementation so the top-level router is focused on wiring and middleware, and feature logic lives in discoverable modules.

## Implementation Approach

- Create dedicated handler modules (for example `backend/src/api/workout.rs`) and move workout-related handler functions out of `backend/src/api/handlers.rs` into those modules.
- Keep `backend/src/api/mod.rs` and the router assembly thin: import handler functions from the new modules and register routes/middleware only.
- Preserve public function signatures used by the router; refactor internals rather than changing the handler API surface.
- Run iterative compile/test cycles and fix visibility/import issues as they appear.

## Risks and Assumptions

- Assumes existing handler functions are reasonably self-contained and have no hidden global state that must remain in the original file.
- Risk of minor compile breakage due to `pub` visibility or module path changes; these are expected and should be fixed in small commits.

## Validation Plan

- Execute `cargo test --manifest-path backend/Cargo.toml` and fix failures.
- Build the backend binary (`cargo build --manifest-path backend/Cargo.toml`) to check for compile errors.
- Optionally exercise key endpoints (workout-related) with `curl` or integration tests to confirm behavior unchanged.

## Out of Scope

- Adding or removing API routes, changing OpenAPI contracts, or altering middleware semantics.

## Handoff Notes for Implementation

- Keep changes granular: move one logical group (e.g., workout) at a time and run tests between moves.
- Prefer small commits with clear messages like "refactor(api): move workout handlers into backend/src/api/workout.rs".
