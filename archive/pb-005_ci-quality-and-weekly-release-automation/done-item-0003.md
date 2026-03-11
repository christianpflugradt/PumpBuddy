# Item 0003 - Renderer Lint and Test Baseline

## Goal

Establish a renderer quality baseline with executable lint and unit test commands.

## Scope

- add renderer tooling and configuration required for linting TypeScript source
- add renderer tooling and configuration required for unit tests
- expose stable `npm` scripts in `renderer/package.json` for lint and test execution

## Acceptance Criteria

- `renderer/package.json` contains runnable `lint` and `test` scripts for CI
- renderer project includes the minimal configuration files needed for those scripts to execute non-interactively
- executable verification:
  `cd renderer && npm run lint && npm run test -- --run`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- wiring renderer commands into GitHub Actions jobs
- release workflow changes


## Review Acceptance

- Criteria Met: `renderer/package.json` exposes runnable `lint` and `test` scripts for CI, and the renderer includes the supporting non-interactive configuration and test entrypoints needed for those commands to execute.
- Evidence: `renderer/package.json` defines `lint` as `node ./scripts/run-lint.mjs` and `test` as `node ./scripts/run-tests.mjs`; `renderer/tsconfig.json` provides the TypeScript project configuration used by the lint command; `renderer/scripts/run-lint.mjs` executes `tsc --noEmit`; `renderer/scripts/run-tests.mjs` executes the Node test runner against `src/app.test.ts`.
- Runtime/Build Check: Executed `cd renderer && npm run lint && npm run test -- --run`; observed result: both commands exited successfully, and the test run reported `pass 3`, `fail 0`.
- Residual Risk: The lint baseline is currently TypeScript compile-time checking via `tsc --noEmit`, so stylistic or non-type lint rules are not covered.
