# Raise Backend Coverage With Meaningful Tests

## Goal

Increase backend test confidence toward the plan target with meaningful tests, or record a justified explanation for any remaining high-cost coverage gap.

## Scope

- identify the highest-value uncovered backend logic or integration paths
- add focused backend tests that improve confidence without inflating low-value coverage
- update coverage reporting or repository feedback if a justified residual gap remains after the meaningful additions

## Acceptance Criteria

- `cargo test --manifest-path backend/Cargo.toml` passes
- `agent/scripts/check-backend-coverage.sh` reports backend branch coverage at or above the repository threshold after the item changes, or the repository contains explicit feedback explaining why remaining uncovered areas are not worth low-value tests
- new backend tests cover meaningful business logic, persistence behaviour, or API transitions rather than mechanical line-filling
- the item does not reduce existing backend coverage reporting fidelity

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/tests/persistence_integration.rs`
- `agent/scripts/check-backend-coverage.sh`

## Out of Scope

- adding broad UI automation to satisfy backend coverage goals
