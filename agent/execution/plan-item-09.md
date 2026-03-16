# Plan: Align CI and Docs with Renderer Vitest Baseline

## Item Reference

- `agent/execution/open-item-09.md`

## Goal Summary

Ensure renderer unit tests and coverage run via Vitest in CI and contributor docs, so the renderer test flow is consistent and the existing CI quality gates remain unchanged.

## Implementation Approach

- Search `.github/workflows` for any renderer test jobs that invoke Node's built-in test runner or use Node-specific test flags; replace those invocations to run the renderer npm scripts that call Vitest (use `npm --prefix renderer run test` and `npm --prefix renderer run test:coverage`).
- Update contributor-facing docs (e.g. `README.md` or `docs/testing.md`) to show the Vitest commands and examples for running tests and coverage locally and in CI.
- If `renderer/package.json` does not expose `test` and `test:coverage` scripts that run Vitest, add/adjust those scripts to invoke `vitest` and `vitest --coverage` respectively.
- Run the renderer test and coverage commands locally to verify they complete and produce coverage artifacts; adjust CI job environment (node version, env vars) only if required by Vitest.

## Risks and Assumptions

- Assumes `renderer` can run Vitest locally and that `renderer/package.json` either already has `test`/`test:coverage` or they can be added without breaking other consumers.
- Assumes CI runners have Node versions compatible with Vitest and necessary dependencies for coverage reporting.

## Validation Plan

- Verify `npm --prefix renderer run test` exits with success and runs the renderer unit tests.
- Verify `npm --prefix renderer run test:coverage` generates coverage output and exits with success.
- Inspect modified CI workflow files in a branch and ensure jobs still have the same pass/fail semantics and quality gates.
- Confirm contributor docs reference Vitest commands and include the two verification commands above.

## Out of Scope

- Non-renderer CI workflows and release pipeline changes.

## Handoff Notes for Implementation

- Files to edit: `.github/workflows/**` (renderer test jobs), `renderer/package.json` (scripts), contributor docs (`README.md` or `docs/testing.md`).
- Create a small PR that updates CI and docs together and includes local run output in the PR description if available.
