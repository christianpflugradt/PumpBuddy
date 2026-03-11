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

- `item-0005`

## Out of Scope

- changing commit conventions outside release configuration
- README badge updates
