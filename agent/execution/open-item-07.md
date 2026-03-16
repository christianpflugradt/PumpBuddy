# Consolidate DB Integration Coverage in Backend Integration Tests

## Goal

Ensure live PostgreSQL persistence behavior is asserted only in backend integration suites with risk-based scenario prioritization and no duplicate DB-backed coverage in unit/module tests.

## Scope

- move remaining DB-backed persistence scenarios into integration tests under `backend/tests/`
- eliminate duplicated DB-backed scenarios between unit/module and integration layers
- prioritize integration coverage for critical happy paths and selected high-value edge cases
- keep integration tests aligned with current persistence semantics

## Acceptance Criteria

- integration tests are the only layer asserting live PostgreSQL persistence behavior
- duplicated DB-backed scenarios across unit and integration layers are removed
- integration suite covers critical happy paths plus selected high-value edge conditions
- executable verification: `cargo test --manifest-path backend/Cargo.toml --test persistence_integration`

## References

- `agent/strategy/plan.md`
- `FINDINGS.quality.md`
- `backend/tests/persistence_integration.rs`
- `backend/src/persistence/tests.rs`
- `agent/strategy/test-strategy.md`

## Dependencies

- `item-06`

## Out of Scope

- broad E2E test rollout
- unrelated backend feature development
