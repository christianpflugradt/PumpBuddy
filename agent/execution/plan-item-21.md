# Plan: Align Renderer Coverage Checks With Supported Node Flags

## Item Reference

- `agent/execution/open-item-21.md`

## Goal Summary

Align the renderer coverage script and CI Node version so `npm run coverage:check` succeeds and emits the expected all-files summary in CI.

## Implementation Approach

- review `.github/workflows/ci-quality.yml` renderer job Node version and current `renderer/scripts/run-coverage.mjs` flag usage
- choose the smallest change: either bump the renderer job Node version to one that supports the coverage flags or update `run-coverage.mjs` to use flags supported by the CI Node version
- ensure the script still captures/prints the all-files summary required by the check (adjust parsing/output if the flag change affects format)

## Risks and Assumptions

- changing the CI Node version might affect other renderer steps or cached dependencies
- altering coverage flags could change output formatting that the script relies on

## Validation Plan

- run `npm run coverage:check` in `renderer/` (or the CI-equivalent command) and confirm the all-files summary appears
- spot-check the renderer quality job definition to ensure the Node version/flags are aligned

## Out of Scope

- changing coverage thresholds or adding new test suites

## Handoff Notes for Implementation

- prefer the minimal change that keeps CI stable and avoids broader Node upgrades unless required
