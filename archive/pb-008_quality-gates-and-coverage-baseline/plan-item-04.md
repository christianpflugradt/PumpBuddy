# Plan: Add one primary local quality command

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Add one repository-root command that developers can run locally to execute the same critical backend and renderer quality categories currently enforced through CI.

## Implementation Approach

- Keep `make check` as the thin repository-root entrypoint and keep `agent/scripts/run-quality.sh` as the single owner of the backend and renderer command sequence.
- Fix the current backend formatting failure first so the root command completes successfully in a prepared environment before changing the quality orchestration further.
- Verify the shared script still covers backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage in a stable order without duplicating long command lists elsewhere.
- Adjust CI or developer-facing documentation only where needed to preserve parity with the shared script and make local prerequisites explicit.

## Risks and Assumptions

- The main implementation risk is not the entrypoint shape but repository state: `make check` currently fails immediately on backend formatting, so acceptance depends on restoring a green baseline.
- Renderer coverage may still rely on setup introduced by earlier items, so implementation should reuse the committed renderer scripts rather than invent a parallel path.
- Backend and renderer checks require different local tooling, so failures should stay direct and actionable instead of being wrapped in opaque orchestration.

## Validation Plan

- Run `make check` from the repository root in a prepared local environment and confirm it completes successfully.
- Confirm `agent/scripts/run-quality.sh check` runs backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage in the intended order.
- Verify CI continues to call the same shared script for backend and renderer quality categories.
- Check that any developer-facing documentation names `make check` and notes required local tooling for coverage steps.

## Out of Scope

- Adding new backend or renderer quality categories beyond those already required by the item.
- Publishing coverage badges or changing coverage thresholds.

## Handoff Notes for Implementation

- Do not replace the current `make` plus shared-script structure unless a concrete maintainability issue appears; the current gap is execution success, not command discovery.
- Treat backend formatting fixes as part of this item because the primary acceptance criterion requires the root quality command to succeed.
- Keep any remediation tightly scoped to the quality entrypoint and parity with CI rather than broad repository cleanup.
