# Plan: Backend persistence remains concentrated in a single cross-cutting repository file

## Item Reference

- `agent/execution/open-item-17.md`

## Goal Summary

Split backend persistence into smaller repository modules so reference-data reads, workout lifecycle writes, and active-workout reconstruction are owned by focused modules instead of a single catch-all file.

## Implementation Approach

- inspect `backend/src/persistence.rs` and identify cohesive groupings (reference-data reads, workout lifecycle writes, active-workout reconstruction/mapping, shared helpers, tests)
- design a small module layout (e.g., `persistence/plan_reads.rs`, `persistence/gym_reads.rs`, `persistence/workout_writes.rs`, `persistence/active_workout.rs`, `persistence/mod.rs`) and move code accordingly
- keep `persistence.rs` as a thin module entrypoint or replace with `persistence/mod.rs`, ensuring public interfaces remain stable for callers
- relocate embedded tests into dedicated module files or `backend/tests/persistence_integration.rs` as appropriate, keeping responsibilities separated
- update imports, module wiring, and any visibility annotations to preserve existing behavior

## Risks and Assumptions

- risk: refactor could subtly change visibility or module paths; mitigate by keeping public function signatures unchanged and minimizing behavior changes
- assumption: existing integration tests cover critical persistence behavior and will catch regressions

## Validation Plan

- run the existing persistence integration tests (likely `cargo test -p backend --test persistence_integration` or equivalent)
- run relevant unit tests in the backend crate to confirm no regressions

## Out of Scope

- changing SQL behavior or persistence logic beyond structural refactor
- introducing new persistence abstractions or dependencies

## Handoff Notes for Implementation

- keep entrypoint files thin per `agent/strategy/engineering-guardrails.md`
- preserve SQLx usage and explicit SQL; avoid ORM or new data-access patterns
- maintain separation between reference-data reads and workout lifecycle writes
