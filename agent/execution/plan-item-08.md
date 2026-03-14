# Plan: Remove Abandoned Pages Actions Dependencies

## Item Reference

- `agent/execution/open-item-08.md`

## Goal Summary

Replace abandoned GitHub Pages actions in the CI quality workflow with maintained alternatives while preserving current coverage badge publication behavior and trust-boundary expectations.

## Implementation Approach

- Inspect the `publish-coverage-badges` job in `.github/workflows/ci-quality.yml` to identify current usage of `actions/configure-pages` and `actions/deploy-pages` and any outputs consumed by later steps.
- Replace the abandoned Pages actions with maintained, supported workflow steps that keep artifact preparation and publishing semantics equivalent for `main` pushes and manual dispatches.
- Preserve existing workflow permissions (`contents: read`, `pages: write`, `id-token: write`) and keep the artifact flow centered on `actions/upload-pages-artifact` output without broadening exposure.
- Ensure the environment URL wiring remains valid after replacement (or is adjusted to a valid maintained-output source) so the job stays structurally correct.

## Risks and Assumptions

- GitHub-hosted maintained alternatives may have slightly different output names or deployment metadata wiring requirements.
- Manual dispatch runs with partial upstream job execution rely on unchanged fallback behavior for badge restoration.

## Validation Plan

- Run a concrete workflow-structure check (for example, `act` simulation or equivalent YAML/action validation) focused on the updated `publish-coverage-badges` job.
- Confirm `.github/workflows/ci-quality.yml` has no references to `actions/configure-pages` or `actions/deploy-pages`.
- Verify the Pages publish path still prepares `site/`, uploads with `actions/upload-pages-artifact`, and preserves existing conditional artifact download and fallback restoration behavior.

## Out of Scope

- redesigning non-Pages CI jobs
- changing coverage badge generation format, naming, or source scripts

## Handoff Notes for Implementation

- Keep changes narrowly scoped to `.github/workflows/ci-quality.yml` unless validation requires a minimal supporting update.
- Do not alter item acceptance criteria; treat this plan as implementation guidance only.
- Favor pinned, maintained GitHub Actions references consistent with current repository security posture.
