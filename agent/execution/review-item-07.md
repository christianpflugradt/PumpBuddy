# Fix Renderer Node Option Failure

## Goal

Restore renderer quality workflow compatibility by removing the unsupported Node.js option from the test runner path.

## Scope

- update the renderer test execution path so CI no longer depends on the unsupported `--experimental-strip-types` Node.js option
- keep the renderer quality command surface consistent with the current Vite and npm-based tooling
- add or adjust renderer-side checks only if needed to preserve the existing test workflow

## Acceptance Criteria

- renderer quality no longer depends on `--experimental-strip-types` in CI or the local npm test path
- `npm --prefix renderer test -- --run` passes
- the renderer quality workflow in `.github/workflows/ci-quality.yml` remains compatible with the updated command path

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/test-strategy.md`
- `.github/workflows/ci-quality.yml`
- `renderer/package.json`

## Out of Scope

- unrelated renderer UI changes
- backend quality fixes
