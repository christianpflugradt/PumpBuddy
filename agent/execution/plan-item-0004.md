# Plan: Add one primary local quality command

## Item Reference

- `agent/execution/open-item-0004.md`

## Goal Summary

Add one repository-root command that developers can run locally to execute the same critical backend and renderer quality categories currently enforced through CI.

## Implementation Approach

- Inspect the existing backend and renderer quality commands, including the backend coverage script and renderer package scripts, and define one root-level entrypoint that orchestrates them in a maintainable order.
- Prefer a lightweight repository-native wrapper such as `make check` if it fits the current structure cleanly; otherwise use a shared script that keeps the command list defined once and callable from both local workflows and CI.
- Wire the primary command to cover backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage without copying long command sequences into multiple places.
- Update CI or adjacent automation only as needed so the local entrypoint and CI categories stay aligned and future drift is easy to detect.
- Document the supported local command where developers already look for workflow guidance, keeping prerequisites explicit when coverage steps depend on local tooling or environment setup.

## Risks and Assumptions

- The renderer coverage command may still depend on work from `item-0003`, so implementation should reuse the committed renderer quality entrypoint rather than invent a parallel coverage path.
- Backend and renderer checks may require different local prerequisites, so the root command should fail clearly and preserve the first actionable error instead of hiding step output.
- A root-level `make` dependency is acceptable only if it keeps the workflow simpler than an additional shell script and does not introduce duplication with existing CI commands.

## Validation Plan

- Run the new root-level quality command from the repository root in a prepared local environment.
- Confirm the command executes backend validation, backend tests, backend coverage, renderer validation, renderer tests, and renderer coverage in the intended order.
- Verify the workflow definition or shared automation references the same underlying commands for the covered categories, or explicitly note any remaining dependency on `item-0003`.
- Check that the developer-facing documentation names the new primary local command and its required environment assumptions.

## Out of Scope

- Adding new backend or renderer quality categories beyond those already required by the item.
- Publishing coverage badges or changing coverage thresholds.

## Handoff Notes for Implementation

- Keep the root entrypoint thin and delegate substantive backend and renderer work to repository-local commands or scripts that already own those checks.
- Prefer alignment with existing GitHub Actions categories over exact command-by-command mirroring if one side still needs a small wrapper for maintainability.
