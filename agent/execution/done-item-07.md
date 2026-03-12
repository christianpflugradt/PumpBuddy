# Add Meaningful Backend Tests And Coverage Follow-Through

## Goal

Improve backend confidence after the structural refactor with meaningful tests and any necessary coverage-gate follow-through that remains aligned with the updated strategy.

## Scope

- add or improve backend tests for meaningful API, persistence, or PostgreSQL-backed behaviour exposed by the review and refactor work
- preserve or improve backend coverage reporting fidelity while keeping branch coverage as a hard stakeholder-facing signal
- adjust the hard backend coverage gate only if the updated repository standard explicitly justifies a tighter threshold

## Acceptance Criteria

- `cargo test --manifest-path backend/Cargo.toml` passes
- `agent/scripts/check-backend-coverage.sh` passes
- new or updated tests cover meaningful backend behaviour or persistence interactions rather than mechanical line-filling
- if the backend coverage threshold changes, the repository contains an explicit standards-based reason for the change and the executable gate still measures branch coverage

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/engineering-guardrails.md`
- `backend/src/main.rs`
- `backend/src/persistence.rs`
- `backend/tests/persistence_integration.rs`
- `agent/scripts/check-backend-coverage.sh`
- `agent/tmp/pb-013-backend-structure-review.md`

## Dependencies

- `item-05`
- `item-06`

## Out of Scope

- broad renderer or end-to-end test expansion
- coverage-padding tests that do not improve confidence


## Review Acceptance

- Criteria Met: All item-07 acceptance criteria are satisfied. `backend/src/main.rs` is a thin entrypoint focused on startup and dependency assembly (`backend/src/main.rs:2`, `backend/src/main.rs:33`, `backend/src/main.rs:42`, `backend/src/main.rs:46`). Meaningful backend tests cover PostgreSQL-backed persistence behavior in `backend/tests/persistence_integration.rs:10`, `backend/tests/persistence_integration.rs:102`, `backend/tests/persistence_integration.rs:141`, `backend/tests/persistence_integration.rs:160`, `backend/tests/persistence_integration.rs:344`, `backend/tests/persistence_integration.rs:571`, and `backend/tests/persistence_integration.rs:656`, and the committed change that moved the item into review added shared test support plus database-backed API integration coverage in `backend/tests/support/mod.rs` and `backend/tests/api_integration.rs`.
- Evidence: The review commit `75e77f8` (`test(backend): add database-backed API integration coverage`) introduced `backend/tests/api_integration.rs` and `backend/tests/support/mod.rs`, reducing duplicated harness setup while adding API coverage for active-workout conflicts and SQL error mapping. The persistence layer retains focused repository tests around gym summaries, gym-specific option reads, workout round trips, and active-workout lifecycle behavior (`backend/src/persistence.rs:1026`, `backend/src/persistence.rs:1057`, `backend/src/persistence.rs:1094`, `backend/src/persistence.rs:1258`). This aligns with the item scope and the testing strategy requirement for meaningful persistence and PostgreSQL-backed integration coverage rather than mechanical line filling.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml` passed with 38 tests total (26 unit tests, 3 API integration tests, 9 persistence integration tests). `agent/scripts/check-backend-coverage.sh` passed and reported `Backend branch coverage: 44.35% (55/124)`, which is above the 40% minimum branch-coverage gate.
- Residual Risk: Integration tests still return early when no Docker socket or external test database is available in `backend/tests/support/mod.rs`, so missing infrastructure can still reduce local confidence without failing the suite.
