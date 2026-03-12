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
