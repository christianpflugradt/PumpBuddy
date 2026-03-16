# Enforce Backend Unit Test Isolation from Real DB

## Goal

Convert backend unit/module persistence tests to isolated logic tests with mocked or fake dependencies so unit tests do not depend on a live PostgreSQL database.

## Scope

- replace DB-backed unit/module persistence test setup with mock/fake dependency seams
- keep unit tests focused on logic, mapping, and branch behavior that does not require real DB integration
- remove DB bootstrap/schema setup from unit/module test paths
- preserve meaningful edge and error branch validation in the unit layer

## Acceptance Criteria

- backend unit/module tests run without real database dependencies
- unit tests validate isolated logic through mocked or fake dependencies
- DB-backed assertions are removed from unit/module persistence test files
- executable verification: `cargo test --manifest-path backend/Cargo.toml --lib`

## References

- `agent/strategy/plan.md`
- `FINDINGS.quality.md`
- `backend/src/persistence/tests.rs`
- `agent/strategy/test-strategy.md`

## Out of Scope

- adding new product behavior
- reducing required backend integration coverage
