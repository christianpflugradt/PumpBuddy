# DomainRepository is a cross-cutting persistence god object

## Summary

The backend persistence boundary is concentrated in one 1,288-line repository that owns plan reads, gym reads, workout lifecycle writes, active-workout recovery, mapping, and embedded tests, which makes the persistence layer the default landing place for unrelated changes.

## Evidence

- `wc -l` reports [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs) at 1,288 lines.
- [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L36) implements training-plan aggregate loading, while [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L182) and [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L202) handle gym and option summary queries.
- The same file also owns workout lifecycle mutations and active-workout recovery at [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L320), [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L410), [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L426), [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L437), [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L448), and [backend/src/persistence.rs](/Users/cpf/Workspace/personal/PumpBuddy/backend/src/persistence.rs#L697).

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

- `backend/src/persistence.rs`
- `backend/src/api/handlers.rs`
- `agent/strategy/engineering-guardrails.md`
