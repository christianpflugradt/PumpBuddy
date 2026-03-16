# Extended Review Findings

Review Task: review-quality

Summary:

- 3 findings identified
- overall readiness: follow-up work recommended before acceptance

<!-- FINDING -->
# Critical workflow performance baseline is limited to `/health`
Priority: P2

## Summary

The current performance smoke baseline only validates `/health`, which provides limited confidence for user-critical workout and persistence paths.

## Evidence

- `backend/src/api/handlers.rs` defines `health_endpoint_latency_smoke` and measures only `GET /health`.
- `agent/scripts/run-quality.sh` maps the `performance` command to `cargo test ... health_endpoint_latency_smoke` only.
- no equivalent latency/performance smoke checks were found for write-heavy or stateful workflow endpoints such as active workout create/update/complete paths.

## Goal

Add lightweight, repeatable performance smoke coverage for at least one critical workout workflow endpoint in addition to `/health`.

## Scope

- introduce one or more bounded smoke checks that exercise critical workout API paths under realistic in-process conditions
- keep checks deterministic and suitable for CI/runtime quality workflows
- keep `/health` smoke coverage intact while broadening confidence for real workflow latency behavior

## Acceptance Criteria

- backend quality flow includes at least one non-`/health` workflow latency smoke check
- smoke checks have explicit, configurable thresholds similar to current `/health` baseline behavior and stay low-flake
- quality scripts execute new performance checks without introducing flaky behavior

## References

- `backend/src/api/handlers.rs`
- `agent/scripts/run-quality.sh`
<!-- END FINDING -->

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

Consolidate backend test responsibilities so unit/module tests do not overlap with each other, while integration tests stay focused on HTTP-plus-database edges.

## Scope

- define explicit boundaries: unit/module tests cover isolated logic and mapping behavior; integration tests cover API/DB interaction edges
- remove or refactor overlapping unit/module scenarios where the same behavior is tested multiple times at the same layer
- keep intentional cross-layer overlap only where integration tests validate end-to-end edge behavior

## Acceptance Criteria

- unit/module persistence tests no longer duplicate each other for the same behavior
- integration tests primarily validate HTTP and database integration boundaries for critical flows
- duplicated scenarios at the same test layer are reduced or eliminated while required confidence remains intact
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

## Scope

- start with a single resilient scenario for the core workout path rather than a broad suite
- harden selectors/test seams to avoid frequent rewrites for expected incremental UI evolution
- keep execution bounded in existing quality workflows and avoid brittle UI automation sprawl

## Acceptance Criteria

- one critical workflow runs as an automated end-to-end scenario against the running system
- end-to-end scenario remains stable through at least one subsequent incremental feature change without test rewrite
- end-to-end layer complements existing unit/integration coverage without replacing it

## References

- `agent/strategy/test-strategy.md`
- `renderer/src/app.test.ts`
<!-- END FINDING -->
