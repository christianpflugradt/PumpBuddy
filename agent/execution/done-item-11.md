# DomainRepository is a cross-cutting persistence god object

## Summary

The backend persistence boundary is concentrated in one large persistence module group that owns plan reads, gym reads, workout lifecycle writes, active-workout recovery, mapping, and embedded tests, which makes the persistence layer the default landing place for unrelated changes.

## Evidence

- The persistence surface is spread across multiple files that still live under the same boundary in `backend/src/persistence/`.
- `backend/src/persistence/training_plans.rs` implements training-plan aggregate loading and plan/gym summary queries.
- `backend/src/persistence/workouts.rs` and `backend/src/persistence/active_workouts.rs` own workout lifecycle mutations and active-workout recovery paths.
- `backend/src/persistence/tests.rs` embeds repository tests alongside the persistence modules.

## Goal

Split persistence ownership into smaller repository modules aligned to coherent read/write responsibilities so backend changes do not keep accumulating inside one cross-cutting file.

## Scope

- separate workout lifecycle persistence from plan and gym lookup queries
- extract mapping helpers or focused repository modules for active-workout reconstruction
- keep SQLx and explicit SQL, but reduce the number of unrelated responsibilities per file

## Acceptance Criteria

- persistence code is organized into multiple focused modules rather than one catch-all repository file
- no single persistence module owns both reference-data queries and the full active-workout mutation lifecycle
- future persistence changes for plans, gyms, and workouts can be made in separate files without touching a central god object

## References

- `backend/src/persistence/mod.rs`
- `backend/src/persistence/training_plans.rs`
- `backend/src/persistence/workouts.rs`
- `backend/src/persistence/active_workouts.rs`
- `backend/src/persistence/tests.rs`
- `backend/src/api/handlers.rs`
- `agent/strategy/engineering-guardrails.md`


## Review Acceptance

- Criteria Met: Persistence responsibilities are split across focused modules (training plans, workouts, active workouts, tests) and no single module mixes reference-data queries with full active-workout mutation lifecycle; the DomainRepository now delegates to those modules.
- Evidence: `backend/src/persistence/training_plans.rs` holds plan/gym queries, `backend/src/persistence/workouts.rs` owns workout creation/fetch/summary, and `backend/src/persistence/active_workouts.rs` owns active-workout lifecycle and reconstruction while `backend/src/persistence/mod.rs` only wires the repository and shared helpers.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml --lib` -> ok (26 passed).
- Residual Risk: None identified; refactor is structural with no behavior changes observed.
