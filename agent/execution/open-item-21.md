# Align Renderer Coverage Checks With Supported Node Flags

## Goal

Make the renderer coverage check in CI pass by ensuring the Node version and coverage flags in `renderer/scripts/run-coverage.mjs` match what CI installs.

## Scope

- update `.github/workflows/ci-quality.yml` to use a Node version that supports the `--test-coverage-*` flags or update the renderer coverage script to use supported flags
- verify `renderer/scripts/run-coverage.mjs` produces the expected summary output for CI checks

## Acceptance Criteria

- `ci-quality.yml` renderer quality job passes with `npm run coverage:check`
- the renderer coverage output includes the all-files summary required by the script

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `renderer/scripts/run-coverage.mjs`
- `renderer/package.json`
