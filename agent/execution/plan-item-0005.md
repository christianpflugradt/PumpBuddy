# Plan: Publish coverage badges and quality usage docs

## Item Reference

- `agent/execution/open-item-0005.md`

## Goal Summary

Expose backend and renderer coverage status in the README through links a reviewer can actually open, and keep the documented repository-root quality command aligned with the committed tooling.

## Implementation Approach

- Keep `make check` as the README quality entrypoint and verify its wording against `Makefile` plus `agent/scripts/run-quality.sh` before touching the documentation text.
- Replace the current local-artifact and source-file badge targets with a repository-visible badge publication path that can hold one backend coverage artifact and one renderer coverage artifact.
- Add or update a small committed helper flow that derives badge values from the existing backend and renderer coverage outputs so badge content can be refreshed from repository tooling instead of manual README edits.
- Update the README badge markup to point at the published artifacts and keep the quality workflow section concise: command, CI-aligned check order, and the minimum prerequisites required to run coverage locally.

## Risks and Assumptions

- `item-0004` already established `make check` as the root quality entrypoint, so this item should not introduce an alternate command.
- The current coverage generators likely emit local-only outputs; implementation may need a thin transformation step to produce committed badge artifacts without changing the underlying coverage commands.
- Backend coverage still depends on `cargo-llvm-cov` and `llvm-tools-preview`; README prerequisites should mention those requirements without turning into full setup documentation.

## Validation Plan

- Verify the README contains exactly one backend coverage badge and one renderer coverage badge, and that both links resolve to repository-visible artifacts rather than ignored local build outputs.
- Verify the badge values can be regenerated from committed tooling without editing the README text directly.
- Verify the documented command remains `make check` and matches `Makefile` plus `agent/scripts/run-quality.sh`.
- Run the badge refresh flow and `make check` if feasible, or otherwise confirm the README prerequisites and check ordering still match the executable scripts.

## Out of Scope

- Changing backend or renderer coverage thresholds.
- Broad CI redesign or adding new quality categories beyond what is needed to publish and document the existing workflow.

## Handoff Notes for Implementation

- Keep the README edit compact: badges stay near the top and the quality command stays in the existing workflow section.
- Prefer published badge assets or equivalent repository-visible outputs over badges that point at ignored files or arbitrary source files.
- Treat existing coverage commands as the source of truth for the numbers; any added helper should consume their outputs, not reimplement coverage calculation.
