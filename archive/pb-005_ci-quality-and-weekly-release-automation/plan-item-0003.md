# Plan: Renderer Lint and Test Baseline

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Add a minimal renderer lint and unit test baseline so CI can run stable `npm` commands for source quality checks.

## Implementation Approach

- extend `renderer/package.json` with `lint` and `test` scripts that run non-interactively in CI
- add the smallest required linting toolchain for the existing TypeScript renderer source and keep it aligned with the current Vite setup
- add Vitest-based unit test wiring and a basic test file or setup needed to prove the test command executes successfully
- add only the supporting config files required for command execution, such as ESLint and Vitest configuration, without expanding scope into CI wiring

## Risks and Assumptions

- the renderer currently has no test harness, so the baseline may need one minimal example test to keep `npm run test -- --run` executable
- linting should stay focused on TypeScript source under `renderer/src` and avoid introducing unnecessary style or formatting policy
- dependency additions should remain lightweight and consistent with the existing Web Components, TypeScript, and Vite stack

## Validation Plan

- run `cd renderer && npm run lint`
- run `cd renderer && npm run test -- --run`

## Out of Scope

- GitHub Actions or other CI workflow changes
- broader renderer architecture changes beyond the lint/test baseline
- adding comprehensive test coverage beyond what is needed to establish the baseline

## Handoff Notes for Implementation

- prefer conservative defaults and minimal config over opinionated tooling expansion
- keep the plan aligned with the item acceptance criteria and avoid redefining renderer standards beyond executable lint and test commands
