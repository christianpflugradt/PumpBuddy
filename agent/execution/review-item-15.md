# Renderer coverage signal is both failing and mislabeled

## Summary

The renderer quality signal is currently unreliable: the enforced coverage gate is red, and the published badge code still labels the renderer metric as line coverage even though the check that failed in this review was branch coverage.

## Evidence

- Running `npm run coverage:check` in `renderer/` failed during this review with `77.41%` branch coverage against the configured `80%` threshold.
- `renderer/scripts/run-coverage.mjs:17-21` enables branch, function, and line thresholds, but `renderer/scripts/run-coverage.mjs:39-57` extracts only the first coverage column and writes a badge labeled `renderer line coverage`.
- The same run reported the uncovered branches all coming from the generated `app.js` built from `renderer/src/app.ts`, confirming that the current renderer quality gate is not passing.

## Goal

Restore a trustworthy renderer coverage signal by getting the quality check back to green and ensuring the published badge reflects the actual enforced metric.

## Scope

- add or improve renderer tests to cover the currently uncovered decision paths, or reduce branch complexity through focused refactoring
- align badge generation with the metric the repository intends stakeholders to read
- keep the work focused on renderer test confidence and reporting accuracy rather than redesigning the product flow

## Acceptance Criteria

- `npm run coverage:check` in `renderer/` passes
- the published renderer coverage badge reports the same metric the repository treats as the gating signal
- renderer coverage output and badge labeling no longer disagree about whether the primary signal is branch or line coverage

## References

- `renderer/scripts/run-coverage.mjs`
- `renderer/src/app.ts`
- `renderer/src/app.test.ts`
- `agent/scripts/run-quality.sh`
- `.github/workflows/ci-quality.yml`
