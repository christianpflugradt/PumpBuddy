# Plan: Add renderer quality and coverage enforcement

## Item Reference

- `agent/execution/open-item-0003.md`

## Goal Summary

Add executable renderer quality tooling so linting, tests, and coverage can run locally and in CI, with CI failing when renderer coverage drops below the agreed threshold.

## Implementation Approach

- inspect the current renderer quality entrypoints in `renderer/package.json`, `renderer/scripts/`, and `.github/workflows/ci-quality.yml` to keep the change aligned with the existing lightweight TypeScript and Vite setup
- add or update renderer package scripts so `npm run lint`, renderer tests, and a dedicated coverage verification command are all executable through repository-supported commands
- introduce the minimum renderer test tooling needed to collect coverage and enforce a pragmatic threshold through code, not workflow prose
- update the renderer CI job to run install, lint, tests, and coverage verification for renderer changes using the committed lockfile state

## Risks and Assumptions

- the current renderer test runner uses Node's built-in test flow, so coverage enforcement may require a small tooling adjustment or an added dev dependency
- the threshold should be set from the existing renderer baseline and enforced in repository tooling so local and CI behavior stay consistent
- `npm ci` in `renderer/` must remain reproducible after any package or lockfile updates

## Validation Plan

- run `npm ci` in `renderer/`
- run `npm run lint` in `renderer/`
- run the renderer test command in `renderer/`
- run the renderer coverage verification command in `renderer/`
- confirm the renderer portion of `.github/workflows/ci-quality.yml` executes lint, tests, and coverage enforcement for renderer changes

## Out of Scope

- backend coverage enforcement
- README badge publication

## Handoff Notes for Implementation

- keep the renderer quality flow simple and repository-local; avoid introducing framework-heavy frontend tooling
- enforce coverage through executable package scripts or checked-in helper scripts so reviewers can verify behavior directly
