# Plan: Fix Renderer Node Option Failure

## Item Reference

- `agent/execution/open-item-07.md`

## Goal Summary

Remove the unsupported `--experimental-strip-types` dependency from the renderer test path while keeping the existing `npm test` and CI quality entrypoints working.

## Implementation Approach

- inspect `renderer/scripts/run-tests.mjs` and `renderer/scripts/run-coverage.mjs` and replace the current direct TypeScript test execution path with a supported runner flow
- update the renderer test setup in the smallest way that keeps `npm --prefix renderer test -- --run` and coverage execution aligned with the repository’s Node and Vite-based tooling
- verify whether `.github/workflows/ci-quality.yml` only needs command compatibility confirmation or a small command-path adjustment after the script changes

## Risks and Assumptions

- the repository currently uses Node’s built-in test runner rather than Vitest, so the fix should avoid introducing unnecessary framework drift
- coverage handling must continue to produce the expected output format for the renderer badge step in `renderer/scripts/run-coverage.mjs`

## Validation Plan

- run `npm --prefix renderer test -- --run`
- run the renderer quality path or the equivalent renderer lint and coverage commands needed to confirm CI compatibility
- confirm the renderer quality workflow still invokes a valid command path after the test runner change

## Out of Scope

- unrelated renderer UI or styling changes
- backend quality or workflow changes outside renderer command compatibility

## Handoff Notes for Implementation

- keep the plan lightweight and scoped to the current open item acceptance criteria
- prefer script-level or package-script adjustments over broader toolchain changes unless the narrower path cannot satisfy the acceptance criteria
