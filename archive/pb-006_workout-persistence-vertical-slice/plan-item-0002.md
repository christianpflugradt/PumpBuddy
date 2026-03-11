# Plan: Add Gym Selection Read Path

## Item Reference

- `agent/execution/open-item-0002.md`

## Goal Summary

Expose seeded gyms through the backend so the renderer can request selectable gym summaries from PostgreSQL via the existing API contract.

## Implementation Approach

- Add a dedicated gym summary read shape in the backend domain layer if the existing `Gym` type is broader than the contract needs.
- Implement a `DomainRepository` query that reads seeded gyms from `gyms`, returns stable ordering, and keeps SQL inside the persistence layer.
- Add an Axum `GET /api/gyms` handler in `backend/src/main.rs`, map repository results into the contract response shape, and reuse the existing internal error response path.
- Keep the endpoint read-only and additive so it fits the current renderer-to-backend boundary without changing other API behavior.
- Extend the existing backend `gyms`-focused test coverage so `cargo test gyms` verifies the repository query and, if already covered in the current test style, the handler-facing behavior indirectly through response mapping assumptions.

## Risks and Assumptions

- The OpenAPI `GymSummary` schema is assumed to be limited to the summary fields already needed by the renderer, so no broader domain projection should be added.
- Stable ordering should follow persisted seed order or another deterministic column order; implementation should pick one explicit rule and keep tests aligned with it.
- Existing backend tests appear repository-centric, so endpoint verification may remain indirect unless there is already a lightweight HTTP test pattern in place.

## Validation Plan

- Run `cd backend && cargo test gyms`.
- Verify the `/api/gyms` response fields and ordering match `agent/design/api-contract.yaml`.

## Out of Scope

- Renderer consumption of the new endpoint.
- Any gym write path, filtering, pagination, or administrative management.
- Broader domain or schema cleanup unrelated to listing seeded gym summaries.

## Handoff Notes for Implementation

- Keep the response contract-driven: the OpenAPI YAML remains the authority for the returned JSON shape.
- Prefer a small additive change set in `backend/src/domain.rs`, `backend/src/persistence.rs`, and `backend/src/main.rs` rather than introducing new abstractions.
