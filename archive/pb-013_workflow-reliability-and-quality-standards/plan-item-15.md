# Plan: Renderer coverage signal is both failing and mislabeled

## Item Reference

- Stable item id: `item-15`

## Goal Summary

Get the renderer coverage check back to passing and make the generated coverage badge report the same primary metric that the renderer gate enforces.

## Implementation Approach

- Inspect the uncovered branch paths in `renderer/src/app.ts` and extend `renderer/src/app.test.ts` with focused tests around the decision-heavy workout flow helpers and app interactions that currently miss branch coverage.
- If a small refactor makes those paths easier to test without changing behavior, extract that logic into small pure helpers while keeping `renderer/src/app.ts` as orchestration code rather than adding more inline branching.
- Update `renderer/scripts/run-coverage.mjs` so it parses and publishes the enforced renderer metric consistently, including matching badge label text to the gating metric instead of hardcoding line coverage.
- Verify the renderer quality path through the existing script entrypoint so local and CI behavior stay aligned.

## Risks and Assumptions

- The largest branch gaps are assumed to be in UI flow and confirmation handling inside `renderer/src/app.ts`; if the uncovered paths are elsewhere, the plan should still stay focused on the minimum test additions needed to satisfy the gate.
- Coverage parsing depends on the current Node test coverage table format, so any badge-script change should avoid brittle assumptions beyond the specific metric row/column being read.

## Validation Plan

- Run `npm run test -- --run` in `renderer/`.
- Run `npm run coverage:check` in `renderer/`.
- Confirm the generated renderer badge payload uses the same metric name and percentage family as the enforced quality gate.

## Out of Scope

- Redesigning the workout UX or changing item acceptance criteria.
- Changing backend coverage, CI job structure, or unrelated badge/reporting behavior.

## Handoff Notes for Implementation

- Keep the fix implementation-oriented: prefer targeted tests first, with only minimal refactoring where testability or branch reduction clearly improves.
- Preserve existing renderer stack and current quality entrypoints defined in `agent/scripts/run-quality.sh` and `.github/workflows/ci-quality.yml`.
