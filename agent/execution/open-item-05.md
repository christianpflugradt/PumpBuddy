# Relocate Backend Route Tests to Feature Modules

## Goal

Move route-level tests out of the backend router composition module into feature-focused modules so tests follow handler ownership boundaries.

## Scope

- extract route-level tests from router/wiring module into feature handler test modules
- keep test intent and endpoint behavior assertions equivalent after relocation
- ensure router module retains only minimal composition-oriented test coverage where needed
- keep test naming and organization aligned with feature boundaries

## Acceptance Criteria

- route-level tests are no longer concentrated in the router composition module
- feature modules own their relevant endpoint behavior tests
- backend API tests remain passing with equivalent behavior coverage
- executable verification: `cargo test --manifest-path backend/Cargo.toml`

## References

- `agent/strategy/plan.md`
- `FINDINGS.architecture.md`
- `backend/src/api/handlers.rs`
- `backend/src/api/mod.rs`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-04`

## Out of Scope

- adding new endpoint behavior not already in scope
- broad backend test-strategy changes outside API route tests
