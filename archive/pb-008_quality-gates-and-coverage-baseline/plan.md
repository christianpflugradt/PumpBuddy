# Plan: Quality Gates and Coverage Baseline

## Plan ID

pb-008

## Goal

Restore a reliable green quality pipeline, make the quality checks locally reproducible through one primary command, and introduce pragmatic coverage reporting and enforcement for backend and frontend.

## Scope

- fix the current failing CI quality workflow for the Rust backend and TypeScript frontend
- introduce one reliable local quality entrypoint such as `make check` that runs the relevant validation steps before push
- align local quality checks with the checks enforced by CI to reduce post-push workflow failures
- ensure backend and frontend tests run successfully as part of the quality flow
- add backend branch coverage measurement and frontend line or statement coverage measurement
- publish backend and frontend coverage badges in the README
- enforce pragmatic minimum coverage thresholds in CI, targeting about 80 percent where realistic and lowering only if the current codebase cannot support that threshold without test padding
- inspect for significant durable test gaps, primarily in backend logic, and add focused unit-level tests where they protect important long-lived behavior

## Out of Scope

- broad end-to-end test investment
- fragile UI tests for frontend areas that are still expected to change quickly
- large refactors that are not required to restore or operationalize the quality gates
- raising coverage through low-value tests written primarily to satisfy a metric

## Success Criteria

- the CI quality workflow passes for the repository with the intended backend and frontend checks enabled
- developers can run one primary local command to execute the relevant quality checks before push
- the local quality command covers the same critical validation categories as the CI quality workflow
- backend and frontend test suites pass within the quality flow
- CI calculates backend branch coverage and frontend line or statement coverage and fails when coverage drops below the agreed thresholds
- the README displays current backend and frontend coverage badges
- newly added tests focus on meaningful backend or other durable logic rather than short-lived surface behavior

## Constraints

- prefer a simple developer workflow, with `make check` as the leading option if it fits the repository cleanly
- keep the quality command and CI setup easy to understand and maintain
- prefer unit tests and narrowly scoped logic tests over long-running integration or end-to-end tests
- focus test additions on stable or high-value logic, especially in the backend
- use backend branch coverage as the preferred backend metric
- use frontend line or statement coverage as the preferred frontend metric
- choose coverage thresholds pragmatically, starting near 80 percent only where that reflects real quality rather than artificial test inflation

## Inputs

- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`
- `agent/strategy/test-strategy.md`
- `agent/design/use-cases.md`
- `agent/design/domain-model.md`

## Refinement Note

Refinement should derive execution items from this plan.
If the plan is unclear or incomplete, refinement must report the gap instead of changing this file.
