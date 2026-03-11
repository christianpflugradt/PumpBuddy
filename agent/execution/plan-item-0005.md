# Plan: Publish coverage badges and quality usage docs

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Expose backend and renderer coverage status in the README and document the existing repository-root quality command so a reviewer can follow the documented workflow locally.

## Implementation Approach

- Confirm the committed root quality entrypoint from `Makefile` and `agent/scripts/run-quality.sh`, then keep README command text aligned to the existing `make check` flow rather than introducing alternate wording.
- Inspect the backend and renderer coverage outputs already produced by repository tooling, then choose one badge source and URL pattern that can represent both coverage values consistently in the README.
- Add one backend coverage badge and one renderer coverage badge near the existing top-of-README badges so coverage status is visible without restructuring the document.
- Keep the local quality documentation compact: name `make check`, describe the CI-aligned categories it runs, and mention only the prerequisites that are essential for backend and renderer coverage execution.

## Risks and Assumptions

- `item-0004` is already expected to provide the root entrypoint; implementation should treat `make check` as authoritative unless the committed tooling changes again before work starts.
- Coverage badges are only useful if their source can be refreshed by current repository automation, so implementation should avoid badge schemes that require manual edits after each run.
- Backend coverage depends on `agent/scripts/check-backend-coverage.sh`, which in turn requires `cargo llvm-cov` and LLVM coverage tools; the README should call out those prerequisites without duplicating script internals.

## Validation Plan

- Verify the README contains exactly one backend coverage badge and one renderer coverage badge with working badge/image links.
- Verify the documented command is `make check` and that it matches `Makefile` plus `agent/scripts/run-quality.sh`.
- Run `make check` in a supported local environment if feasible, or at minimum verify the README-described categories and prerequisites match the executable scripts already committed.
- Check that the README prerequisites cover the required backend coverage tooling and renderer dependency installation without drifting into broader setup documentation.

## Out of Scope

- Changing backend or renderer coverage thresholds.
- Adding new quality checks or expanding CI scope beyond documenting the existing workflow.

## Handoff Notes for Implementation

- Keep the README change compact and reader-oriented: badges near the top, quality command documentation near existing developer workflow guidance.
- Prefer durable badge URLs that do not require manual editing after each coverage run if the repository automation already produces a suitable source.
- Use the committed repository tooling as the source of truth; if badge publication automation is still missing, choose the simplest badge approach that can be supported by the current quality workflow.
