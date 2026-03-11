# Item 0004 - Renderer CI Quality Gate

## Goal

Add renderer lint and test enforcement to CI for renderer-relevant pull requests.

## Scope

- implement a renderer CI job in `.github/workflows/ci-quality.yml`
- run renderer lint and test scripts from `renderer/package.json` in CI
- ensure the renderer CI job runs only when renderer-relevant paths change

## Acceptance Criteria

- renderer CI job executes `npm ci`, `npm run lint`, and `npm run test -- --run` from the `renderer` directory
- renderer CI job is conditionally gated by renderer path changes
- executable verification:
  `rg -n "renderer|npm ci|npm run lint|npm run test -- --run|if:" .github/workflows/ci-quality.yml`

## References

- `agent/strategy/plan.md`
- `agent/strategy/test-strategy.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-0001`
- `item-0003`

## Out of Scope

- backend CI commands
- release automation
