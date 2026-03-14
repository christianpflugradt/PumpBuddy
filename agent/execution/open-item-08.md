# Remove Abandoned Pages Actions Dependencies

## Goal

Address abandoned Pages GitHub Actions dependencies by removing or replacing `actions/configure-pages` and `actions/deploy-pages` with maintained alternatives.

## Scope

- update `.github/workflows/ci-quality.yml` Pages publish job to avoid abandoned actions
- preserve coverage badge publication behavior on main branch pushes/workflow dispatches
- keep workflow permissions and artifact flow aligned with current security baseline

## Acceptance Criteria

- `.github/workflows/ci-quality.yml` no longer references `actions/configure-pages` or `actions/deploy-pages`
- replacement workflow path is valid and keeps badge artifact publication semantics intact
- `act` simulation, workflow validation, or equivalent concrete check confirms the updated Pages publish job remains structurally valid

## References

- `agent/strategy/plan.md`
- `.github/workflows/ci-quality.yml`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`
- `agent/scripts/prepare-pages-artifacts.sh`

## Out of Scope

- redesigning non-Pages CI jobs
