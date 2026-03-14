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
