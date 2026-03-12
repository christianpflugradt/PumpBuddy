# Plan: Renderer CI Quality Gate

## Item Reference

- `agent/execution/open-item-04.md`

## Goal Summary

Add a renderer-specific CI job to `.github/workflows/ci-quality.yml` that installs renderer dependencies and runs lint and test commands only when renderer-relevant files change.

## Implementation Approach

- Inspect the existing `ci-quality.yml` workflow structure and reuse its current job gating pattern rather than introducing a new workflow design.
- Add a renderer change-detection condition that covers the `renderer/` tree and any workflow files that should trigger renderer validation.
- Define a renderer CI job that runs in the `renderer` directory and executes `npm ci`, `npm run lint`, and `npm run test -- --run`.
- Keep the job isolated from backend checks so the item remains limited to renderer enforcement.

## Risks and Assumptions

- The existing workflow may already use a shared path-filter or gating mechanism; the implementation should extend that pattern instead of duplicating logic.
- The renderer scripts in `renderer/package.json` are assumed to exist and be CI-safe without additional environment setup.
- Path gating must be broad enough to catch renderer-relevant changes without triggering on unrelated backend-only edits.

## Validation Plan

- Review `.github/workflows/ci-quality.yml` to confirm the renderer job is conditionally gated by renderer-relevant path changes.
- Verify the workflow contains the required commands with:
  `rg -n "renderer|npm ci|npm run lint|npm run test -- --run|if:" .github/workflows/ci-quality.yml`
- If practical during implementation, run a YAML sanity check or targeted workflow linting available in the repository.

## Out of Scope

- Backend CI commands or backend job restructuring.
- Release automation or non-CI renderer changes.

## Handoff Notes for Implementation

- Preserve existing workflow conventions for job naming, conditions, and working-directory configuration.
- Prefer minimal edits to the current CI file so the change stays easy to review and aligned with the item scope.
