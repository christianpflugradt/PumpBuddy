# Plan: Implement SQLx Domain Persistence Foundations

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Introduce backend domain and SQLx persistence foundations for pb-004 entities, replacing startup-time table bootstrap logic with `backend/init.sql`-driven initialization and enabling representative aggregate read/write paths.

## Implementation Approach

- Remove inline schema/table creation from backend startup and rely on `backend/init.sql` as the schema authority.
- Define Rust domain models and DB row mappings for:
  - training plans and ordered plan exercises
  - exercises, variants, gyms, and gym-specific plan exercise options
  - workouts, workout exercises, and workout sets
- Add SQLx-based repository/data-access modules using explicit SQL for representative aggregate operations:
  - persist/retrieve `training_plan` with ordered exercises and options
  - persist/retrieve `workout` with exercises and sets
- Keep persistence modules separate from HTTP handler wiring so transport concerns do not absorb domain/data logic.

## Risks and Assumptions

- Assumes `backend/init.sql` already provides required pb-004 tables/constraints from earlier items.
- Aggregate hydration across multiple joined tables can introduce ordering or duplication bugs if query shape/mapping is not explicit.
- Some domain invariants may still require application-level enforcement even with SQL constraints in place.

## Validation Plan

- Run acceptance command: `cd backend && cargo check`
- Run acceptance command: `cd backend && cargo test`
- Add/adjust focused tests for repository aggregate round-trips (training plan path and workout path), prioritizing integration coverage where DB interaction is central.

## Out of Scope

- Full workout wizard orchestration
- Renderer/frontend integration with these domain entities
- New API surface expansion beyond persistence foundations required by the item

## Handoff Notes for Implementation

- Keep OpenAPI contract-first and tech-stack constraints intact (Rust + SQLx explicit SQL, no ORM).
- Preserve current item scope and acceptance criteria exactly; avoid pulling in unrelated refactors.
- If runtime bootstrap changes require minor startup wiring updates, keep them minimal and persistence-focused.
