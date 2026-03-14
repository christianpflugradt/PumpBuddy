# Plan: Trigger Semantic Release From Finalize Flow

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Extend plan finalization so a successful finalize commit/push also dispatches the `Release` GitHub Actions workflow through GitHub CLI.

## Implementation Approach

- Update `agent/scripts/finalize-plan.sh` to add a post-push `gh workflow run` call targeting `.github/workflows/release.yml` (or equivalent workflow identifier), executed only after finalize success conditions are met.
- Keep release-dispatch logic out of earlier finalize steps so no dispatch attempt occurs when archive, commit, or push fails.
- Add explicit error handling around dispatch so failures are surfaced with clear messaging and non-zero exit behavior.

## Risks and Assumptions

- Assume `gh` is available and authenticated in environments where release dispatch is expected to run.
- Risk of duplicate releases if dispatch is retried externally; limit this item to single-dispatch behavior per successful finalize invocation.

## Validation Plan

- Run `agent/scripts/finalize-plan.sh` in a controlled success scenario with a stubbed/logged `gh` binary and confirm exactly one release workflow dispatch invocation.
- Verify dispatch is not attempted when finalize exits before commit/push success.
- Verify dispatch failures are clearly surfaced and cause finalize to fail.

## Out of Scope

- Any changes to semantic-release analysis/configuration in `.releaserc.json`.

## Handoff Notes for Implementation

- Keep the change scoped to finalize flow behavior and do not alter unrelated release or tagging logic.
- Preserve existing finalize sequencing and side effects, adding release dispatch only as a post-push step.
