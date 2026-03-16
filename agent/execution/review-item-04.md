# Modularize Backend API Router and Handlers

## Goal

Separate backend API transport wiring from endpoint handler implementation so router composition stays thin and feature logic is moved into focused handler modules.

## Scope

- keep top-level API router assembly focused on route and middleware composition
- move endpoint handler implementations out of the concentrated router module into feature-focused modules
- preserve API contract behavior and middleware enforcement
- update module wiring so handler boundaries are explicit and discoverable

## Acceptance Criteria

- router composition module is primarily wiring, not bulk handler implementation
- workout and related endpoint handler logic is split into dedicated feature modules
- existing API behavior remains unchanged for covered routes
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/api/handlers.rs`
- `backend/src/api/mod.rs`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- introducing new API routes
- changing OpenAPI contract semantics
