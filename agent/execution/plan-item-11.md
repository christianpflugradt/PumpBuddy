# Plan: DomainRepository is a cross-cutting persistence god object

## Item Reference

- Stable item id: `item-11`

## Goal Summary

Restructure backend persistence so plan lookups, gym queries, and workout lifecycle persistence live in focused modules instead of a single catch-all repository file.

## Implementation Approach

- Audit `backend/src/persistence.rs` and group existing functions into coherent responsibilities: reference-data reads, workout writes, active-workout reconstruction helpers, and shared error/repository primitives.
- Introduce a `backend/src/persistence/` module layout that keeps `DomainRepository` as the API consumed by handlers while delegating each method to focused submodules.
- Move active-workout mapping and reconstruction helpers next to the workout persistence code, extracting shared row-to-domain conversion helpers only where they are reused across modules.
- Relocate or split persistence tests so each module verifies its own behavior without recreating a new central test sink.

## Risks and Assumptions

- Shared SQLx transaction and row-mapping code may currently be intertwined with repository methods, so the split should avoid over-abstracting just to satisfy file boundaries.
- Handler and application code should continue using `DomainRepository` unchanged unless a clearer boundary improvement falls out naturally from the refactor.
- Existing tests may rely on private helper placement, so test moves will need careful updates rather than mechanical copy/paste.

## Validation Plan

- Run backend tests covering persistence behavior after the module split.
- Verify the backend still compiles cleanly with the new `persistence` module structure.
- Spot-check that handler call sites continue to build against the unchanged repository-facing API.

## Out of Scope

- Changing API behavior, persistence semantics, or workout domain rules.
- Replacing SQLx, changing the database schema, or redesigning repository method signatures beyond what the refactor requires.

## Handoff Notes for Implementation

- Keep `backend/src/main.rs` and HTTP handlers thin; this item is about persistence modularity, not shifting business logic upward.
- Prefer a small number of responsibility-aligned modules over many tiny files with unclear ownership.
- Preserve explicit SQL and meaningful PostgreSQL-backed test coverage where persistence behavior is non-trivial.
