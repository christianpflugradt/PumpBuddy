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


## Review Acceptance

- Criteria Met: `cargo test --manifest-path backend/Cargo.toml` passed; `agent/scripts/check-backend-coverage.sh` passed at the repository threshold with `40.34%` backend branch coverage (`71/176`); the implementation adds meaningful backend API and persistence tests for seeded summary reads, gym-specific option selection, workout not-found handling, and active-workout conflict/not-found paths without weakening coverage reporting.
- Evidence: `backend/src/main.rs` now exercises read endpoints and active-workout error transitions in router-level tests, while `backend/src/persistence.rs` and `backend/tests/persistence_integration.rs` cover repository summary reads, gym-specific option queries, durable active-workout state transitions, and persisted workout round trips. `agent/scripts/check-backend-coverage.sh` still emits the JSON summary and refreshes both backend coverage badge artifacts, so reporting fidelity is preserved.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml` exited `0` with `46 passed; 0 failed` across unit, integration, and doc tests. `agent/scripts/check-backend-coverage.sh` exited `0` and reported `Backend branch coverage: 40.34% (71/176)`.
- Residual Risk: Branch coverage remains well below the broader plan aspiration of about `80%`, so there is still substantial uncovered backend logic; however, this item satisfies the repository threshold and focuses the added tests on meaningful behavior instead of mechanical padding.
