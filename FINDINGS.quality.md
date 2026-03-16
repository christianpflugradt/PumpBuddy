# Extended Review Findings

Review Task: review-quality

Summary:

- 2 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Backend persistence test coverage is duplicated across suites
Priority: P2

## Summary

Persistence scenarios are duplicated across backend unit/module tests and integration tests, increasing maintenance burden and creating unnecessary drift risk.

## Evidence

- `backend/src/persistence/tests.rs` covers create/fetch summaries, active-workout conflict/not-found handling, and cancellation behavior.
- `backend/tests/persistence_integration.rs` re-covers many of the same persistence behaviors (round trips, conflict/not-found states, cancellation semantics).
- overlapping scenario intent appears in both files (for example active-workout conflict and cancellation rules), creating dual maintenance points for behavior changes.

## Goal

Establish strict backend test-layer boundaries: unit tests validate isolated units with mocked dependencies (no real database), while integration tests validate real database integration on prioritized happy paths plus selected high-value edge cases.

## Implementation Direction (Agreed)

Adopt strict test taxonomy: move database-backed scenarios out of unit/module tests, enforce dependency-mocked unit tests for business/mapping logic, and keep integration tests lean by prioritizing happy paths with risk-based edge coverage only.

## Scope

- convert `backend/src/persistence/tests.rs` to true unit coverage (mocked repository dependencies, no live DB bootstrap or schema setup)
- migrate real database behavior checks to integration suites under `backend/tests/` and remove duplicated DB scenarios from unit/module tests
- define integration-test prioritization: cover critical happy paths first, add edge/error cases selectively based on risk and value
- keep unit tests broad and scenario-rich for unit behavior, including edge/error branches that do not require live DB integration

## Acceptance Criteria

- unit tests run without real database dependencies and validate units in isolation via mocks/fakes
- integration tests are the only layer asserting live database integration behavior
- integration suites prioritize happy-path workflow coverage and include only selected high-value edge cases
- duplicated DB-backed scenarios across unit and integration layers are eliminated while required confidence remains intact
- `cargo test --manifest-path backend/Cargo.toml` remains green with equivalent or better defect-detection confidence

## References

- `backend/src/persistence/tests.rs`
- `backend/tests/persistence_integration.rs`
<!-- END FINDING -->

<!-- FINDING -->
# Critical workflow confidence lacks targeted end-to-end coverage
Priority: P2

## Summary

Current tests heavily exercise unit and integration logic, but no targeted end-to-end suite validates the complete user journey through renderer and backend for critical workout flows.

## Evidence

- `agent/strategy/test-strategy.md` defines End-to-End tests as a targeted layer for critical workflows.
- repository search shows no Playwright configuration or end-to-end test files.
- renderer tests in `renderer/src/app.test.ts` validate controller/render logic with fakes, but do not execute against a running full stack.

## Goal

Introduce a minimal, stable end-to-end test slice for one critical workout workflow only if it can remain resilient across normal feature increments.

## Implementation Direction (Agreed)

Implement a single high-value E2E scenario first (minimal slice), keep it stable via durable selectors/test seams, and integrate it into quality workflows with bounded runtime.

## Scope

- start with a single resilient scenario for the core workout path rather than a broad suite
- harden selectors/test seams to avoid frequent rewrites for expected incremental UI evolution
- keep execution bounded in existing quality workflows and avoid brittle UI automation sprawl
- treat this as additive confidence only; do not replace unit/integration responsibilities

## Acceptance Criteria

- one critical workflow runs as an automated end-to-end scenario against the running system
- end-to-end scenario remains stable through at least one subsequent incremental feature change without test rewrite
- end-to-end layer complements existing unit/integration coverage without replacing it
- quality workflow includes this E2E slice in a deterministic, time-bounded execution path

## References

- `agent/strategy/test-strategy.md`
- `renderer/src/app.test.ts`
<!-- END FINDING -->
