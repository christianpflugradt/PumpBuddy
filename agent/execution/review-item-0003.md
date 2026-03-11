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
