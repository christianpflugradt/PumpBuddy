# Migrate Renderer Test and Coverage Tooling to Vitest

## Goal

Adopt Vitest as the single renderer unit-test and coverage runner for local and CI workflows.

## Scope

- add and configure Vitest in renderer tooling
- migrate renderer test and coverage scripts from Node test runner to Vitest commands
- remove Node test-runner specific flags from renderer quality scripts
- preserve current test intent and quality gates after migration

## Acceptance Criteria

- renderer unit tests execute through Vitest locally
- renderer coverage is produced through Vitest and existing quality expectations remain satisfied
- renderer scripts no longer rely on `node --test` or Node experimental test-coverage flags
- executable verification: `npm --prefix renderer run test:coverage`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `agent/strategy/tech-stack.md`
- `renderer/package.json`
- `renderer/scripts/run-tests.mjs`
- `renderer/scripts/run-coverage.mjs`

## Out of Scope

- frontend framework migration
- expanding end-to-end suite breadth
