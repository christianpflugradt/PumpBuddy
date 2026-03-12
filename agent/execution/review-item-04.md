# Replace Committed Coverage Badge Artifacts

## Goal

Move coverage badge publication from committed generated badge files to a GitHub Pages and Shields endpoint flow that does not force follow-up artifact commits.

## Scope

- redesign the backend and renderer badge publication flow around Pages-hosted JSON artifacts and Shields endpoint badges
- update quality scripts and checks so local or CI quality runs no longer depend on committed generated badge freshness
- update README badge links to use the default project Pages URL pattern for `christianpflugradt/PumpBuddy`

## Acceptance Criteria

- README coverage badges no longer point at committed generated SVG badge files and instead reference Pages-hosted endpoint badge sources consistent with `https://christianpflugradt.github.io/PumpBuddy/`
- repository quality checks no longer require a follow-up commit solely because badge artifacts were regenerated during the check flow
- the backend and renderer badge publication flow is documented or encoded in repository scripts closely enough that regeneration does not depend on hidden manual knowledge
- `sh agent/scripts/run-quality.sh check` succeeds without failing on committed badge-artifact freshness requirements

## References

- `agent/strategy/plan.md`
- `agent/strategy/tech-stack.md`
- `README.md`
- `.github/workflows/coverage-badges-pages.yml`
- `agent/scripts/run-quality.sh`
- `agent/scripts/prepare-pages-artifacts.sh`
- `agent/scripts/check-backend-coverage.sh`
- `renderer/scripts/run-coverage.mjs`

## Out of Scope

- changing the backend branch-coverage gate itself
- non-coverage README redesign


## Review Findings

### Criterion

Review task automation remains executable after removing committed badge-artifact checks

- Status: fail
- Evidence: Running `agent/scripts/tasks.sh see` now exits with `Required path missing: agent/scripts/check-quality-artifacts.sh` because [agent/execution/review-item-04.md](/Users/cpf/Workspace/personal/PumpBuddy/agent/execution/review-item-04.md) still lists that deleted script under `## References`. The implementation commit `c3908c1 feat: publish coverage badges via github pages` removes [agent/scripts/check-quality-artifacts.sh](/Users/cpf/Workspace/personal/PumpBuddy/agent/scripts/check-quality-artifacts.sh) but does not update the active review item to match. A bounded runtime check of `sh agent/scripts/prepare-pages-artifacts.sh` did succeed locally, so the badge-generation path itself is not the blocker.
- Risk: Deterministic task-mode review execution is broken for `t: see`, so the repository can no longer complete its own required review workflow for this item. That leaves the badge-flow change accepted only by manual inspection and undermines the task framework the repository depends on.
