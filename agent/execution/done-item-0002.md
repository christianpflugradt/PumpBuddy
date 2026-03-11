# Add focused backend tests for durable logic

## Goal

Increase confidence in durable backend behavior with focused tests that close the most important current coverage gaps.

## Scope

- inspect existing backend logic and identify meaningful long-lived behaviors that are under-tested
- add narrowly scoped backend tests for those behaviors without padding coverage through low-value assertions
- keep added tests aligned with the existing Rust unit or integration testing approach

## Acceptance Criteria

- at least one meaningful backend coverage gap in durable logic is closed by new or expanded tests
- added tests target backend behavior that is expected to remain stable, not incidental implementation details
- `cargo test --manifest-path backend/Cargo.toml` succeeds after the new tests are added
- the backend coverage command introduced by the plan shows a measurable improvement or reaches the enforced threshold without adding trivial tests

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Dependencies

- `item-0001`

## Out of Scope

- changing renderer tests
- broad end-to-end test expansion

## Notes for Review

- check that the new tests protect durable business or persistence behavior
- reject tests whose main value is only to inflate the metric


## Review Findings

### Criterion

the backend coverage command introduced by the plan shows a measurable improvement or reaches the enforced threshold without adding trivial tests

- Status: fail
- Evidence: `agent/scripts/check-backend-coverage.sh` at `0d70e38` exits non-zero and reports `Backend branch coverage: 8.09% (11/136)` followed by `Backend branch coverage 8.09% is below required minimum 65.00%`. The added integration test in `backend/tests/persistence_integration.rs` covers durable active-workout error branches, but the committed review state does not include a baseline comparison that demonstrates a measurable improvement in the enforced branch-coverage metric.
- Risk: Accepting the item would leave its coverage-validation acceptance criterion unproven. The task’s purpose is not only to add focused tests, but to show that those tests materially improve the backend branch-coverage gate or satisfy it.


## Review Acceptance

- Criteria Met: The item adds focused backend tests for durable persistence and API validation behavior, `cargo test --manifest-path backend/Cargo.toml` succeeds, and the backend coverage command now shows a measurable branch-coverage improvement from the prior reviewed baseline of 8.09% (47/144 branches covered now versus 11/136 before) without relying on trivial assertions.
- Evidence: `backend/tests/persistence_integration.rs` exercises durable active-workout persistence, resume, completion, cancellation, and error surfacing against the repository-backed PostgreSQL flow, while `backend/src/main.rs` adds validation-focused tests for request normalization, duplicate positions, invalid identifiers, missing foreign keys, and active-workout invariants. The prior failed review recorded `agent/scripts/check-backend-coverage.sh` at `0d70e38` with `Backend branch coverage: 8.09% (11/136)`. Re-running the same command on the current committed state produced `Backend branch coverage: 32.64% (47/144)`, which is a clear measurable improvement tied to meaningful backend behavior.
- Runtime/Build Check: `cargo test --manifest-path backend/Cargo.toml` passed with 31 tests passing; `agent/scripts/check-backend-coverage.sh` executed successfully through report generation and reported `Backend branch coverage: 32.64% (47/144)` before exiting non-zero because the repository-wide gate remains `65%`.
- Residual Risk: Repository-wide backend branch coverage remains below the enforced threshold, so broader quality-gate work is still required outside the scope of this focused test-gap item.
