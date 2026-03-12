# Plan: Raise Backend Coverage With Meaningful Tests

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Raise backend test confidence from the current low branch-coverage baseline by adding focused tests around meaningful backend API and persistence behavior, while documenting any remaining high-cost uncovered areas instead of padding coverage with low-value assertions.

## Implementation Approach

- Run `agent/scripts/check-backend-coverage.sh` early to establish the current branch-coverage baseline and use the generated summary to identify the largest uncovered backend branches before adding tests.
- Extend backend API tests in `backend/src/main.rs` around currently under-covered read and error paths, especially the summary/list endpoints and the `get_active_workout`/`cancel_active_workout` branches that map repository outcomes into `200`, `404`, `409`, or validation responses.
- Add persistence-focused tests for active-workout history and suggestion behavior in `backend/src/persistence.rs` or `backend/tests/persistence_integration.rs`, targeting branches such as missing historical suggestions, fallback suggested sets, and durable error/not-found transitions that represent real domain behavior.
- Re-run backend coverage after each test increment and update repository feedback only if the remaining uncovered branches are concentrated in disproportionately expensive or low-signal paths that are not worth covering with more tests.

## Risks and Assumptions

- The current baseline from `agent/scripts/check-backend-coverage.sh` is `42.31%` branch coverage, so reaching the plan target may require multiple meaningful test additions rather than one narrow patch.
- Some branches in `backend/src/main.rs` are exercised only when the repository returns specific failures, so tests may need lightweight repository fixtures or targeted database state instead of broad end-to-end setup.
- Coverage should improve through business and persistence behavior that matters in production; branches that exist only for defensive process-exit handling or trivial wrappers may still remain after the meaningful additions.

## Validation Plan

- Run `cargo test --manifest-path backend/Cargo.toml`.
- Run `agent/scripts/check-backend-coverage.sh` and verify backend branch coverage meets the repository threshold or that explicit repository feedback justifies any residual uncovered areas.
- Review the updated coverage summary to confirm new tests hit previously uncovered API or persistence branches rather than only re-exercising already-covered happy paths.

## Out of Scope

- Adding frontend or browser automation to move backend coverage numbers.
- Writing mechanical tests whose main purpose is line-filling rather than validating backend behavior.

## Handoff Notes for Implementation

- Prefer adding tests close to the code that owns the branch, using `backend/src/main.rs` tests for request validation/response mapping and `backend/tests/persistence_integration.rs` for real PostgreSQL-backed behavior.
- Keep any residual-gap explanation concrete by naming the intentionally untested branch family and why covering it would be high-cost or low-value.
