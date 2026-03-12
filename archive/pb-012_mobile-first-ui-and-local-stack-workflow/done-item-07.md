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


## Review Acceptance

- Criteria Met: The renderer test path no longer uses `--experimental-strip-types` in committed scripts, `npm --prefix renderer test -- --run` passes, and the renderer CI workflow remains compatible because `.github/workflows/ci-quality.yml` still executes `../agent/scripts/run-quality.sh renderer`, which calls the same npm test surface.
- Evidence: Commit `b7d3142` updates `renderer/scripts/run-tests.mjs` and `renderer/scripts/run-coverage.mjs` to call `prepareNodeTestEntry("./src/app.test.ts")` and run `node --test` against the emitted JS entry instead of passing `--experimental-strip-types`. `renderer/package.json` still exposes `npm test` as `node ./scripts/run-tests.mjs`.
- Runtime/Build Check: `npm --prefix renderer test -- --run` -> passed with 21 tests, 0 failures on March 12, 2026. Additional verification: `npm --prefix renderer run coverage:check` -> passed and reported 84.25% line coverage.
- Residual Risk: none identified
