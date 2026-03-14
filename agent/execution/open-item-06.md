# Remove Scheduled Release Automation

## Goal

Eliminate scheduled semantic-release execution while preserving manual or finalize-triggered release dispatch paths.

## Scope

- remove `schedule` trigger from `.github/workflows/release.yml`
- keep `workflow_dispatch` release capability intact
- update related release documentation to reflect that release is no longer time-scheduled
- update release-notes type mapping so release notes include all relevant Conventional Commit types while excluding only `docs`
- ensure `build` commits are explicitly included in release-notes sections when present
- prepend release-notes section titles with suitable emojis for improved readability (for example, `🐞 Bug Fixes`)
- add a brief `README.md` section documenting the Conventional Commit types used in this project

## Acceptance Criteria

- `.github/workflows/release.yml` no longer contains a `schedule` trigger
- workflow still exposes `workflow_dispatch` and retains semantic-release job configuration
- `rg -n "schedule|workflow_dispatch" .github/workflows/release.yml` shows `workflow_dispatch` and no `schedule` matches
- `.releaserc.json` release-notes configuration includes `build` and other relevant Conventional Commit types used by the repository, with only `docs` hidden from release notes
- `.releaserc.json` release-notes section titles are emoji-prefixed (for example, `🐞 Bug Fixes`) with clear, human-readable labels
- release commit analysis and release-notes generation remain aligned on Conventional Commit usage after the update
- `README.md` contains a concise section listing the Conventional Commit types used for this repository and notes that `docs` commits are excluded from release notes

## References

- `agent/strategy/plan.md`
- `.github/workflows/release.yml`
- `README.md`
- `.releaserc.json`

## Out of Scope

- implementing alternative cron-based release mechanisms
