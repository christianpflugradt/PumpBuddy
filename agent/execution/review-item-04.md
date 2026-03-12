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
- `agent/scripts/run-quality.sh`
- `agent/scripts/check-quality-artifacts.sh`
- `agent/scripts/check-backend-coverage.sh`
- `renderer/scripts/run-coverage.mjs`

## Out of Scope

- changing the backend branch-coverage gate itself
- non-coverage README redesign
