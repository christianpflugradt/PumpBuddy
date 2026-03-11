# Item 0001 - Path-Aware CI Workflow Skeleton

## Goal

Create a maintainable CI workflow skeleton that separates backend and renderer checks through path-aware gating.

## Scope

- add a GitHub Actions workflow file for quality checks
- define path filter logic that can independently identify backend-relevant and renderer-relevant changes
- structure jobs so backend and renderer quality jobs can run conditionally from the same workflow

## Acceptance Criteria

- `.github/workflows/ci-quality.yml` exists and contains path-aware gating for backend and renderer changes
- the workflow is triggered for pull requests and is structured so unrelated paths do not force both quality jobs to run
- executable verification:
  `rg -n "pull_request|paths|backend|renderer|if:" .github/workflows/ci-quality.yml`

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `agent/strategy/engineering-guardrails.md`

## Out of Scope

- implementing backend command steps
- implementing renderer command steps
- release automation
