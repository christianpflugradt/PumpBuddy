# Remove Scheduled Release Automation

## Goal

Eliminate scheduled semantic-release execution while preserving manual or finalize-triggered release dispatch paths.

## Scope

- remove `schedule` trigger from `.github/workflows/release.yml`
- keep `workflow_dispatch` release capability intact
- update related release documentation to reflect that release is no longer time-scheduled

## Acceptance Criteria

- `.github/workflows/release.yml` no longer contains a `schedule` trigger
- workflow still exposes `workflow_dispatch` and retains semantic-release job configuration
- `rg -n "schedule|workflow_dispatch" .github/workflows/release.yml` shows `workflow_dispatch` and no `schedule` matches

## References

- `agent/strategy/plan.md`
- `.github/workflows/release.yml`
- `README.md`

## Out of Scope

- implementing alternative cron-based release mechanisms
