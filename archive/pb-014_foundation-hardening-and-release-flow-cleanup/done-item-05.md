# Trigger Semantic Release From Finalize Flow

## Goal

Trigger the `Release` GitHub Actions workflow from successful plan finalization after commit and push complete.

## Scope

- update finalize automation to invoke GitHub CLI workflow dispatch for release after successful finalize commit/push
- ensure dispatch is executed only when finalization has succeeded
- handle failure conditions so release trigger errors are surfaced clearly

## Acceptance Criteria

- `agent/scripts/finalize-plan.sh` includes a post-push release workflow trigger using GitHub CLI
- finalize automation attempts release dispatch only after commit and push succeed
- in a controlled local run where `gh` is stubbed/logged, the script emits exactly one release workflow dispatch invocation on success

## References

- `agent/strategy/plan.md`
- `agent/scripts/finalize-plan.sh`
- `.github/workflows/release.yml`
- `agent/strategy/security-baseline.md`
- `agent/strategy/security.md`

## Dependencies

- `item-04`

## Out of Scope

- changing semantic-release commit analysis rules in `.releaserc.json`


## Review Acceptance

- Criteria Met: All item-05 acceptance criteria are satisfied; `agent/scripts/finalize-plan.sh` dispatches the release workflow via GitHub CLI after successful commit/push, and dispatch behavior was validated in a controlled local run.
- Evidence: `agent/scripts/finalize-plan.sh` defines `RELEASE_WORKFLOW_FILE=".github/workflows/release.yml"`, runs `git commit` then `git push` before invoking `gh workflow run "${RELEASE_WORKFLOW_FILE}"`, and exits with explicit errors when `gh` is missing or dispatch fails.
- Runtime/Build Check: Executed `python3` harness that ran `sh agent/scripts/finalize-plan.sh` in an isolated temp repo with a stubbed `gh`; observed `EXIT 0` and exactly one logged invocation: `workflow run .github/workflows/release.yml` (`GH_LOG_LINES 1`).
- Residual Risk: none identified.
