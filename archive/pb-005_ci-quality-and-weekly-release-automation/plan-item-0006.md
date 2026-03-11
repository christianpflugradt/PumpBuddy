# Plan: Weekly Semantic-Release Workflow

## Item Reference

- `agent/execution/open-item-0006.md`

## Goal Summary

Add a GitHub Actions release workflow that can run `semantic-release` on the default branch both on demand and on a weekly Sunday-to-Monday overnight schedule.

## Implementation Approach

- Inspect existing repository release and CI configuration to align the workflow with the current Node/package-manager setup and any existing semantic-release config.
- Add `.github/workflows/release.yml` with `workflow_dispatch` and weekly `schedule` triggers, branch gating for the default branch, and the repository permissions needed for semantic-release.
- Configure the job for non-interactive CI execution, including dependency installation, environment variables, and the semantic-release invocation expected by the repo tooling.

## Risks and Assumptions

- The repository already contains the semantic-release and package-manager configuration needed for CI execution without adding new scope.
- GitHub Actions schedule timing uses UTC, so the cron expression must be chosen carefully to satisfy the Sunday-to-Monday night window intended by the item.
- The workflow should follow existing CI conventions in the repo rather than introducing a separate release runtime pattern.

## Validation Plan

- Review `.github/workflows/release.yml` for the required triggers, permissions, and semantic-release execution path.
- Run `rg -n "schedule|cron|semantic-release|workflow_dispatch|permissions" .github/workflows/release.yml`.
- If repository tooling is present locally, sanity-check the workflow structure against the existing package-manager and release config files.

## Out of Scope

- Changes to commit conventions or release rules beyond what is required to run the workflow.
- README or badge updates related to releases.

## Handoff Notes for Implementation

- Keep the workflow lightweight and consistent with the repository's existing CI patterns.
- Prefer explicit permissions and environment configuration so the release job is deterministic in GitHub-hosted runners.
