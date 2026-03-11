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


## Review Acceptance

- Criteria Met: `.github/workflows/ci-quality.yml` exists, triggers on `pull_request`, and uses path-aware gating plus conditional `if:` job guards so backend and renderer quality jobs only run when their relevant paths change.
- Evidence: The workflow defines `detect-changes` with `dorny/paths-filter` filters for `backend/**` and `renderer/**`, exposes those outputs, and gates `backend-quality` and `renderer-quality` using `if: ${{ needs.detect-changes.outputs.<target> == 'true' }}`.
- Runtime/Build Check: Executed `rg -n "pull_request|paths|backend|renderer|if:" .github/workflows/ci-quality.yml` (exit 0) and observed matches for PR trigger, path filters, backend/renderer sections, and conditional `if:` guards.
- Residual Risk: none identified
