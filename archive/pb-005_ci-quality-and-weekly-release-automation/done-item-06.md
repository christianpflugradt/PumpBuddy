# Item 0006 - Weekly Semantic-Release Workflow

## Goal

Add a weekly scheduled GitHub Actions workflow that runs semantic-release in the Sunday-to-Monday night window.

## Scope

- add a release workflow under `.github/workflows/`
- configure a weekly schedule in the Sunday-to-Monday night window
- execute semantic-release from the workflow with required repository permissions and environment variables

## Acceptance Criteria

- `.github/workflows/release.yml` exists and includes a weekly `schedule` trigger for the Sunday-to-Monday night window
- release workflow runs semantic-release on the default branch and is structured for non-interactive CI execution
- executable verification:
  `rg -n "schedule|cron|semantic-release|workflow_dispatch|permissions" .github/workflows/release.yml`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Dependencies

- `item-05`

## Out of Scope

- changing commit conventions outside release configuration
- README badge updates


## Review Acceptance

- Criteria Met: `.github/workflows/release.yml` exists, includes both `workflow_dispatch` and a weekly `schedule` trigger in the Sunday-to-Monday overnight window (`0 0 * * 1` UTC), and runs `semantic-release` in a non-interactive GitHub Actions job gated to the default branch (`main`) with the required repository write permissions and CI token environment.
- Evidence: The workflow defines `permissions` for `contents`, `issues`, and `pull-requests`; the `semantic-release` job runs only when `github.ref == 'refs/heads/main'`; it sets `CI=true` and `GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}`; and it invokes `semantic-release` through `npx` after a full-history checkout suitable for release analysis.
- Runtime/Build Check: Executed `rg -n "schedule|cron|semantic-release|workflow_dispatch|permissions" .github/workflows/release.yml` and observed matching lines for the scheduled trigger, cron expression, permissions block, and semantic-release invocation with exit code 0.
- Residual Risk: Minor ambiguity remains because the schedule is interpreted in UTC by GitHub Actions, but `0 0 * * 1` still lands in the intended Sunday-to-Monday overnight window.
