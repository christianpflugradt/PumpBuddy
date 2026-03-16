# Plan: Migrate Renderer Test and Coverage Tooling to Vitest

## Item Reference

- `agent/execution/open-item-08.md`

## Goal Summary

Adopt Vitest as the single renderer unit-test and coverage runner so renderer tests and coverage run locally and in CI without relying on `node --test` or Node experimental coverage flags.

## Implementation Approach

- add `vitest` to `renderer/devDependencies` and a minimal `vitest.config.ts` in `renderer/`
- replace `renderer` `scripts.test` and `scripts.test:coverage` to invoke `vitest` CLI (via npm scripts) and remove reliance on `node ./scripts/*.mjs` where possible
- update or replace `renderer/scripts/run-tests.mjs` and `renderer/scripts/run-coverage.mjs` with simple wrappers that call the vitest binary and normalize output for the existing badge pipeline
- ensure coverage thresholds (branches/functions/lines) are enforced via vitest coverage config or the wrapper script and that the badge generation continues to work (adapt parsing to Vitest/c8 output)

## Risks and Assumptions

- assume existing tests are compatible with Vitest (most Node-style unit tests should be); if not, small test updates may be required
- assume CI images can install the `vitest` dependency and run Node-based vitest (no platform-specific tooling required)

## Validation Plan

- run `npm --prefix renderer run test` locally to verify unit tests execute under Vitest
- run `npm --prefix renderer run test:coverage` and confirm coverage summary is produced and badge JSON updated
- confirm `renderer/scripts/*` no longer spawn `node --test` or set `--experimental-test-coverage`

## Out of Scope

- changing test framework or rewriting existing tests
- expanding test coverage beyond current scope

## Handoff Notes for Implementation

- files to modify: `renderer/package.json`, `renderer/scripts/run-tests.mjs`, `renderer/scripts/run-coverage.mjs`, add `renderer/vitest.config.ts`
- maintain existing badge output path `site/badges/renderer-coverage.json` and the existing `agent/scripts/write-coverage-badge.py` integration; adapt parsing logic as needed
