# Plan: Refactor Backend Boundaries

## Item Reference

- Stable item id: `item-06`

## Goal Summary

Refactor the backend so `backend/src/main.rs` is closer to a thin entrypoint, active workout transport logic has clearer module seams, and the backend structure better matches the maintainability guardrails without changing behavior or the API contract.

## Implementation Approach

- Narrow `backend/src/main.rs` to startup, shared state wiring, and router assembly by extracting request/response DTOs, API error mapping, and route handlers into transport-focused modules.
- Introduce an application-facing workout module for active-workout flows so handlers stop owning repository-backed validation and response shaping directly.
- Split `backend/src/persistence.rs` by feature-oriented seams, prioritizing active-workout lifecycle writes and workout-related reads while keeping call sites stable through incremental compatibility wrappers if needed.
- Move only the tests required by the new module seams out of `main.rs`, keeping focused unit coverage near extracted logic and preserving the existing PostgreSQL-backed `cargo test --manifest-path backend/Cargo.toml` path.

## Risks and Assumptions

- The safest path is an internal refactor that preserves current routes, payloads, and repository behavior; any contract change would violate item scope.
- Persistence splitting can create churn if the repository API changes too aggressively, so compatibility wrappers or incremental extraction may be needed.
- Review findings around silent integration-test skips and shared database harnesses are relevant context, but full test-infrastructure consolidation is secondary unless the refactor makes it necessary.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml`.
- Verify the refactor leaves documented backend behavior and OpenAPI-aligned route shapes unchanged.
- Check that `backend/src/main.rs` is materially narrower and focused on startup and router wiring after extraction.
- Confirm extracted transport and application modules line up with the review priorities: thinner entrypoint, less persistence-aware validation in handlers, and clearer persistence seams.

## Out of Scope

- Product behavior changes beyond what is necessary to preserve existing functionality during the refactor.
- Broad test-harness redesign beyond what is needed to support the module extraction.
- Unrelated coverage increases or backend redesign beyond the highest-value structural issues identified in the review.
- Technology changes outside the existing Rust, Axum, SQLx, and PostgreSQL stack.

## Handoff Notes for Implementation

- Favor incremental extraction with compile-safe boundaries over a single large rewrite.
- Keep new modules feature-oriented and discoverable so future backend work does not drift back into `main.rs`.
- Preserve the current backend contract as the source of truth while refactoring internal structure.
