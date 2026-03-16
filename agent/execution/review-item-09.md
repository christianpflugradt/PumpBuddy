# Align CI and Docs with Renderer Vitest Baseline

## Goal

Update CI workflows and contributor documentation so renderer test and coverage execution consistently uses Vitest as the canonical baseline.

## Scope

- update CI job commands to use renderer Vitest test and coverage scripts
- remove any remaining CI references to Node built-in test-runner invocation for renderer unit tests
- update contributor-facing testing documentation to reference Vitest commands
- keep CI quality gates and expected workflow behavior unchanged

## Acceptance Criteria

- CI workflow definitions run renderer unit-test and coverage checks via Vitest commands
- contributor documentation references Vitest as the canonical renderer test flow
- no renderer unit-test CI path relies on Node test-runner specific flags
- executable verification: `npm --prefix renderer run test` and `npm --prefix renderer run test:coverage`

## References

- `agent/strategy/plan.md`
- `FINDINGS.technology.md`
- `agent/strategy/tech-stack.md`
- `renderer/package.json`
- `.github/workflows`

## Dependencies

- `item-08`

## Out of Scope

- non-renderer CI redesign
- release workflow changes
