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


## Review Acceptance

- Criteria Met: All item-05 acceptance criteria are satisfied; `agent/scripts/finalize-plan.sh` dispatches the release workflow via GitHub CLI after successful commit/push, and dispatch behavior was validated in a controlled local run.
- Evidence: `agent/scripts/finalize-plan.sh` defines `RELEASE_WORKFLOW_FILE=".github/workflows/release.yml"`, runs `git commit` then `git push` before invoking `gh workflow run "${RELEASE_WORKFLOW_FILE}"`, and exits with explicit errors when `gh` is missing or dispatch fails.
- Runtime/Build Check: Executed `python3` harness that ran `sh agent/scripts/finalize-plan.sh` in an isolated temp repo with a stubbed `gh`; observed `EXIT 0` and exactly one logged invocation: `workflow run .github/workflows/release.yml` (`GH_LOG_LINES 1`).
- Residual Risk: none identified.
- Criteria Met: `.github/workflows/release.yml` contains only `workflow_dispatch` (no `schedule`), semantic-release job remains intact, `.releaserc.json` includes `build` plus aligned Conventional Commit type handling with only `docs` excluded from notes, and `README.md` documents repository commit types with `docs` exclusion.
- Evidence: `release.yml` lines 3-5 expose `workflow_dispatch`; `.releaserc.json` `releaseRules` and `presetConfig.types` both cover `feat|fix|perf|chore|build|ci|refactor|style|test` and hide/disable only `docs`; section titles are emoji-prefixed (for example `🐞 Bug Fixes`, `🏗 Build System`); `README.md` has a dedicated Conventional Commit section listing all types and the `docs` note.
- Runtime/Build Check: Executed `rg -n "schedule|workflow_dispatch" .github/workflows/release.yml && node -e "JSON.parse(require('fs').readFileSync('.releaserc.json','utf8')); console.log('releaserc-json-ok')"`; observed output shows only `workflow_dispatch` match and `releaserc-json-ok`.
- Residual Risk: none identified.
