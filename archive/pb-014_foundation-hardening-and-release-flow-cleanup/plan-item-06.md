# Plan: Remove Scheduled Release Automation

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Remove the scheduled trigger from the release workflow while keeping manual release dispatch available and updating documentation to match the new release behavior.

## Implementation Approach

- Edit `.github/workflows/release.yml` to remove the `schedule` section and keep `workflow_dispatch` plus the existing semantic-release job unchanged.
- Update release documentation in `README.md` (or the closest release process section) to state releases are no longer cron-scheduled and are run manually or by finalize-driven automation.
- Verify the workflow trigger state with `rg -n "schedule|workflow_dispatch" .github/workflows/release.yml` and do a quick review to confirm no unrelated workflow behavior changed.

## Risks and Assumptions

- Assumes no external process depends on the weekly cron trigger remaining present.
- Documentation may not currently contain release-process detail; if so, add a minimal note at the most relevant existing workflow/release section without expanding scope.

## Validation Plan

- Run `rg -n "schedule|workflow_dispatch" .github/workflows/release.yml` and confirm only `workflow_dispatch` is returned.
- Inspect workflow diff to confirm semantic-release job configuration remains intact.
- Check updated documentation text for consistency with the workflow trigger change.

## Out of Scope

- Adding a replacement scheduled release mechanism.
- Changing semantic-release behavior, job steps, or branch conditions.

## Handoff Notes for Implementation

- Keep the change narrowly focused on trigger configuration and related docs.
- Preserve existing formatting style and action pinning in workflow files.
