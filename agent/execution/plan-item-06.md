# Plan: Refactor Backend Boundaries

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Refactor the backend so `backend/src/main.rs` is closer to a thin entrypoint, active workout transport logic has clearer module seams, and the backend structure better matches the maintainability guardrails without changing behavior or the API contract.

## Implementation Approach

- Extract API transport concerns out of `backend/src/main.rs`, starting with DTOs, API error mapping, and route handler functions, while leaving startup and router assembly in the entrypoint.
- Introduce a dedicated backend module boundary for active workout flows so create, update, complete, and cancel handlers can delegate request validation/mapping and response shaping outside `main.rs`.
- Split `backend/src/persistence.rs` along clearer feature or operation seams, prioritizing active-workout persistence and workout read/write responsibilities while preserving the existing repository-facing API used by handlers.
- Reorganize backend tests around the new seams so extracted validation or mapping logic can keep focused unit coverage and PostgreSQL-backed persistence behavior remains covered by `cargo test --manifest-path backend/Cargo.toml`.

## Risks and Assumptions

- The safest path is an internal refactor that preserves current routes, payloads, and repository behavior; any contract change would violate item scope.
- Persistence splitting can create churn if the repository API changes too aggressively, so compatibility wrappers or incremental extraction may be needed.
- Test moves should reduce duplication where practical, but full test-harness consolidation is secondary unless it is required to keep confidence after the refactor.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml`.
- Verify the refactor leaves the documented backend behavior and OpenAPI-aligned route shapes unchanged.
- Check that `backend/src/main.rs` is materially narrower and focused on startup and router wiring after extraction.

## Out of Scope

- Product behavior changes beyond what is necessary to preserve existing functionality during the refactor.
- Unrelated coverage increases or broad backend redesign beyond the highest-value structural issues identified in the review.
- Technology changes outside the existing Rust, Axum, SQLx, and PostgreSQL stack.

## Handoff Notes for Implementation

- Favor incremental extraction with compile-safe boundaries over a single large rewrite.
- Keep new modules feature-oriented and discoverable so future backend work does not drift back into `main.rs`.
- Preserve the current backend contract as the source of truth while refactoring internal structure.
