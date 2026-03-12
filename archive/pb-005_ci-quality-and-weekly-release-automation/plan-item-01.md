# Plan: Item 0001 - Path-Aware CI Workflow Skeleton

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Create a single CI quality workflow that runs on pull requests and conditionally executes backend and renderer quality jobs based on changed paths.

## Implementation Approach

- Add `.github/workflows/ci-quality.yml` with a `pull_request` trigger.
- Add a path-gating step/job that determines whether backend-related and/or renderer-related files changed.
- Define separate backend and renderer jobs with `if:` conditions tied to the path-gating outputs.
- Keep job command sections as placeholders/skeleton steps only, without adding concrete backend or renderer check commands.

## Risks and Assumptions

- Assumes path patterns can cleanly separate backend and renderer change surfaces without overlap issues.
- Risk that shared files (for example root-level config) may need to trigger both jobs; patterns should account for this explicitly.

## Validation Plan

- Verify workflow file exists and includes `pull_request`, `paths`, `backend`, `renderer`, and conditional `if:` usage.
- Run: `rg -n "pull_request|paths|backend|renderer|if:" .github/workflows/ci-quality.yml` after implementation.
- Confirm both jobs are structurally present and independently gated.

## Out of Scope

- Implementing actual backend quality command steps.
- Implementing actual renderer quality command steps.
- Release automation or non-PR workflow triggers.

## Handoff Notes for Implementation

- Keep the workflow easy to extend with real check commands later.
- Prefer explicit, readable path filter rules over compact but opaque expressions.
- Preserve scope: this item establishes skeleton and gating, not full CI coverage.
