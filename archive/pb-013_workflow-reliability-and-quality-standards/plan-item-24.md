# Plan: Fix Coverage Badge Resource Not Found

## Item Reference

- `agent/execution/open-item-24.md`

## Goal Summary

Ensure the README coverage badge points to a published, reachable image so the badge renders reliably instead of returning a missing resource.

## Implementation Approach

- inspect `.github/workflows` and any badge scripts to identify where coverage badge artifacts are generated/published and the expected public URL pattern
- compare the generated/published badge location against the current README coverage badge URL and update whichever side is misaligned (publish path, filename, branch, or README link target)
- keep the existing CI quality flow intact while making the smallest change needed to restore badge availability
- ensure badge publication remains automated after CI completion so README does not depend on manual badge updates

## Risks and Assumptions

- assume the badge should remain sourced from the repository CI publishing mechanism rather than switching to a third-party coverage badge service
- risk that branch/path mismatches (for example `main` vs `master` or artifact filename drift) can make the badge intermittently unavailable
- risk that README and workflow naming diverged over time; fixing only one side without verification could leave the badge broken

## Validation Plan

- run or inspect the badge-generation/publish workflow configuration to confirm the resolved badge URL matches the actually published asset
- verify the README coverage badge URL responds with a valid image (HTTP success and image content)
- after CI runs with the change, confirm README renders the coverage badge without "resource not found"

## Out of Scope

- redesigning repository-wide badge strategy beyond the coverage badge issue
- changing coverage computation methodology or CI quality gate policy

## Handoff Notes for Implementation

- prefer targeted changes to workflow/scripts/README over broad CI refactors
- document any URL conventions relied on (branch, path, filename) to reduce future drift between publishing and README references
